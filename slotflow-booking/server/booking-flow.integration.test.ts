import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  appointments,
  availabilityRules,
  businesses,
  depositPayments,
  reminderEvents,
  resources,
  services,
  staffMembers,
  staffServices,
  users,
} from "../drizzle/schema";
import {
  completeSimulatedPayment,
  createPublicAppointment,
  getAvailableSlots,
  updateAppointmentState,
  retrySimulatedPayment,
} from "./bookingDb";
import { getDb } from "./db";
import { businessDateStartUtc } from "./time";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("public booking integration", () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const bookingDate = "2026-09-02";
  const timeZone = "Africa/Nairobi";
  const slug = `vitest-booking-${suffix}`;
  let database: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  let ownerId = 0;
  let businessId = 0;
  let serviceId = 0;
  let staffId = 0;
  let resourceId = 0;
  let appointmentId = 0;

  beforeAll(async () => {
    if (!hasDb) {
      console.warn(
        "Skipping integration test because DATABASE_URL is not set."
      );
      return;
    }
    const db = await getDb();
    if (!db)
      throw new Error("Database is required for booking integration tests.");
    database = db;
    const owner = await database
      .insert(users)
      .values({
        openId: `vitest-owner-${suffix}`,
        name: "Booking test owner",
        role: "admin",
      });
    ownerId = Number(owner[0].insertId);
    const business = await database
      .insert(businesses)
      .values({
        ownerId,
        name: "Booking test workspace",
        bookingSlug: slug,
        timezone: timeZone,
        currency: "KES",
      });
    businessId = Number(business[0].insertId);
    const service = await database
      .insert(services)
      .values({
        businessId,
        name: "Test treatment",
        durationMinutes: 60,
        priceCents: 3500,
        depositCents: 1000,
        color: "#71805B",
      });
    serviceId = Number(service[0].insertId);
    const staff = await database
      .insert(staffMembers)
      .values({ businessId, name: "Test specialist", color: "#71805B" });
    staffId = Number(staff[0].insertId);
    const resource = await database
      .insert(resources)
      .values({
        businessId,
        name: "Test room",
        resourceType: "Room",
        capacity: 1,
      });
    resourceId = Number(resource[0].insertId);
    await database.insert(staffServices).values({ staffId, serviceId });
    await database
      .insert(availabilityRules)
      .values({
        businessId,
        targetType: "business",
        dayOfWeek: 3,
        startMinute: 9 * 60,
        endMinute: 12 * 60,
        active: true,
      });
  });

  afterAll(async () => {
    if (!database || !businessId) return;
    await database
      .delete(reminderEvents)
      .where(eq(reminderEvents.appointmentId, appointmentId || -1));
    await database
      .delete(depositPayments)
      .where(eq(depositPayments.appointmentId, appointmentId || -1));
    await database
      .delete(appointments)
      .where(eq(appointments.businessId, businessId));
    await database
      .delete(availabilityRules)
      .where(eq(availabilityRules.businessId, businessId));
    await database
      .delete(staffServices)
      .where(
        and(
          eq(staffServices.staffId, staffId),
          eq(staffServices.serviceId, serviceId)
        )
      );
    await database
      .delete(staffMembers)
      .where(eq(staffMembers.businessId, businessId));
    await database
      .delete(resources)
      .where(eq(resources.businessId, businessId));
    await database.delete(services).where(eq(services.businessId, businessId));
    await database.delete(businesses).where(eq(businesses.id, businessId));
    await database.delete(users).where(eq(users.id, ownerId));
  });

  it("creates a payment-pending reservation, queues reminders, blocks a conflicting retry, and cancels queued reminders", async () => {
    const startsAt =
      businessDateStartUtc(bookingDate, timeZone) + 9 * 60 * 60_000;
    const first = await createPublicAppointment({
      slug,
      serviceId,
      staffId,
      resourceId,
      startsAt,
      bookingDate,
      customerName: "Integration customer",
      customerEmail: "integration@example.test",
      customerPhone: "0712345678",
    });
    appointmentId = first.appointmentId;
    expect(first.paymentStatus).toBe("pending");

    const remaining = await getAvailableSlots({
      slug,
      serviceId,
      staffId,
      resourceId,
      date: bookingDate,
    });
    expect(remaining).not.toContain(startsAt);
    await expect(
      createPublicAppointment({
        slug,
        serviceId,
        staffId,
        resourceId,
        startsAt,
        bookingDate,
        customerName: "Conflicting customer",
        customerPhone: "0799999999",
      })
    ).rejects.toThrow(/booked|available/i);

    const paid = await completeSimulatedPayment(
      first.providerReference,
      "paid"
    );
    expect(paid.appointmentStatus).toBe("paid");
    const queued = await database
      .select()
      .from(reminderEvents)
      .where(eq(reminderEvents.appointmentId, appointmentId));
    expect(queued).toHaveLength(2);
    expect(queued.every(reminder => reminder.status === "scheduled")).toBe(
      true
    );

    await updateAppointmentState(ownerId, appointmentId, "cancelled");
    const cancelled = await database
      .select()
      .from(reminderEvents)
      .where(eq(reminderEvents.appointmentId, appointmentId));
    expect(cancelled.every(reminder => reminder.status === "cancelled")).toBe(
      true
    );
  });

  it("prevents double-booking under concurrent requests", async () => {
    const startsAt =
      businessDateStartUtc(bookingDate, timeZone) + 14 * 60 * 60_000;
    const attempts = await Promise.allSettled([
      createPublicAppointment({
        slug,
        serviceId,
        staffId,
        resourceId,
        startsAt,
        bookingDate,
        customerName: "Concurrent 1",
        customerPhone: "0700000001",
      }),
      createPublicAppointment({
        slug,
        serviceId,
        staffId,
        resourceId,
        startsAt,
        bookingDate,
        customerName: "Concurrent 2",
        customerPhone: "0700000002",
      }),
    ]);
    const successes = attempts.filter(r => r.status === "fulfilled");
    const failures = attempts.filter(r => r.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Clean up created appointment so it doesn't leak
    if (successes[0] && successes[0].status === "fulfilled") {
      await updateAppointmentState(
        ownerId,
        successes[0].value.appointmentId,
        "cancelled"
      );
    }
  });

  it("ignores expired pending appointments when calculating availability and rejects their payments", async () => {
    const startsAt =
      businessDateStartUtc(bookingDate, timeZone) + 16 * 60 * 60_000;
    const hold = await createPublicAppointment({
      slug,
      serviceId,
      staffId,
      resourceId,
      startsAt,
      bookingDate,
      customerName: "Expired hold",
      customerPhone: "0700000003",
    });

    // Manually force expiry by setting expiresAt to the past
    await database
      .update(appointments)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(appointments.id, hold.appointmentId));

    // Should be available now
    const remaining = await getAvailableSlots({
      slug,
      serviceId,
      staffId,
      resourceId,
      date: bookingDate,
    });
    expect(remaining).toContain(startsAt);

    // Payment should be rejected
    await expect(
      completeSimulatedPayment(hold.providerReference, "paid")
    ).rejects.toThrow(/expired/i);
    await expect(retrySimulatedPayment(hold.providerReference)).rejects.toThrow(
      /expired/i
    );
  });
});
