import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  appointments,
  availabilityRules,
  businesses,
  depositPayments,
  reminderEvents,
  reminderSettings,
  resources,
  services,
  staffMembers,
  staffServices,
  users,
} from "../drizzle/schema";
import {
  buildAvailableSlotStarts,
  buildBookingReference,
  buildSimulatedMpesaReference,
  canTransitionAppointment,
  REMINDABLE_APPOINTMENT_STATES,
  hasSchedulingConflict,
  sanitizePhone,
  type AppointmentState,
} from "./booking";
import { getDb } from "./db";
import {
  businessDateForTimestamp,
  businessDateStartUtc,
  dayOfWeekForBusinessDate,
} from "./time";

const DEMO_SLUG = "slotflow-studio";
const DAY = 86_400_000;

async function database() {
  const db = await getDb();
  if (!db) throw new Error("The database is currently unavailable.");
  return db;
}

export async function getBusinessByOwner(ownerId: number) {
  const db = await database();
  return (
    (
      await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerId, ownerId))
        .limit(1)
    )[0] ?? null
  );
}

export async function getBusinessBySlug(slug: string) {
  const db = await database();
  return (
    (
      await db
        .select()
        .from(businesses)
        .where(eq(businesses.bookingSlug, slug))
        .limit(1)
    )[0] ?? null
  );
}

async function seedBusinessData(businessId: number) {
  const db = await database();
  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, businessId))
    .limit(1);
  if (existing.length) {
    await seedMissingAppointments(businessId);
    return;
  }

  await db.insert(services).values([
    {
      businessId,
      name: "Signature Silk Press",
      description: "A polished wash, conditioning treatment, and silk finish.",
      durationMinutes: 90,
      priceCents: 5500,
      depositCents: 1500,
      color: "#71805B",
    },
    {
      businessId,
      name: "Restorative Facial",
      description: "A targeted ritual for replenished, luminous skin.",
      durationMinutes: 60,
      priceCents: 4200,
      depositCents: 1000,
      color: "#B27B58",
    },
    {
      businessId,
      name: "Brow Sculpt",
      description: "Shape, tint, and a clean finishing detail.",
      durationMinutes: 45,
      priceCents: 2200,
      depositCents: 500,
      color: "#667A87",
    },
  ]);
  const seededServices = await db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId))
    .orderBy(asc(services.id));

  await db.insert(staffMembers).values([
    {
      businessId,
      name: "Maya Mwangi",
      roleTitle: "Senior stylist",
      email: "maya@slotflow.demo",
      phone: "+254700000101",
      color: "#71805B",
    },
    {
      businessId,
      name: "Nia Wanjiru",
      roleTitle: "Skin therapist",
      email: "nia@slotflow.demo",
      phone: "+254700000102",
      color: "#B27B58",
    },
    {
      businessId,
      name: "Noah Kimani",
      roleTitle: "Brow artist",
      email: "noah@slotflow.demo",
      phone: "+254700000103",
      color: "#667A87",
    },
  ]);
  const seededStaff = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.businessId, businessId))
    .orderBy(asc(staffMembers.id));

  await db.insert(resources).values([
    {
      businessId,
      name: "Studio Chair 01",
      resourceType: "Styling chair",
      capacity: 1,
    },
    {
      businessId,
      name: "Treatment Room A",
      resourceType: "Treatment room",
      capacity: 1,
    },
  ]);
  const seededResources = await db
    .select()
    .from(resources)
    .where(eq(resources.businessId, businessId))
    .orderBy(asc(resources.id));

  await db.insert(staffServices).values([
    { staffId: seededStaff[0]!.id, serviceId: seededServices[0]!.id },
    { staffId: seededStaff[1]!.id, serviceId: seededServices[1]!.id },
    { staffId: seededStaff[2]!.id, serviceId: seededServices[2]!.id },
  ]);

  await db.insert(availabilityRules).values(
    [1, 2, 3, 4, 5].map(dayOfWeek => ({
      businessId,
      targetType: "business" as const,
      dayOfWeek,
      startMinute: 9 * 60,
      endMinute: 18 * 60,
    }))
  );

  const tomorrow = new Date(Date.now() + DAY);
  const appointmentStart = Date.UTC(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate(),
    8,
    0
  );
  const appointmentRows = await db.insert(appointments).values([
    {
      businessId,
      serviceId: seededServices[0]!.id,
      staffId: seededStaff[0]!.id,
      resourceId: seededResources[0]!.id,
      customerName: "Amina Hassan",
      customerEmail: "amina@example.com",
      customerPhone: "+254700100200",
      startsAt: appointmentStart,
      endsAt: appointmentStart + 90 * 60_000,
      status: "confirmed",
      totalCents: 5500,
      depositCents: 1500,
      paymentStatus: "paid",
      bookingReference: buildBookingReference(),
    },
    {
      businessId,
      serviceId: seededServices[1]!.id,
      staffId: seededStaff[1]!.id,
      resourceId: seededResources[1]!.id,
      customerName: "Miriam Otieno",
      customerEmail: "miriam@example.com",
      customerPhone: "+254700100201",
      startsAt: appointmentStart + 2 * 60 * 60_000,
      endsAt: appointmentStart + 3 * 60 * 60_000,
      status: "paid",
      totalCents: 4200,
      depositCents: 1000,
      paymentStatus: "paid",
      bookingReference: buildBookingReference(),
    },
  ]);

  const createdIds = [
    Number(appointmentRows[0].insertId),
    Number(appointmentRows[0].insertId) + 1,
  ];
  await db.insert(depositPayments).values([
    {
      appointmentId: createdIds[0]!,
      providerReference: buildSimulatedMpesaReference(),
      phone: "+254700100200",
      amountCents: 1500,
      status: "paid",
      requestedAt: appointmentStart - DAY,
      completedAt: appointmentStart - DAY,
    },
    {
      appointmentId: createdIds[1]!,
      providerReference: buildSimulatedMpesaReference(),
      phone: "+254700100201",
      amountCents: 1000,
      status: "paid",
      requestedAt: appointmentStart - DAY,
      completedAt: appointmentStart - DAY,
    },
  ]);
}

async function seedMissingAppointments(businessId: number) {
  const db = await database();
  const current = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.businessId, businessId))
    .limit(1);
  if (current.length) return;
  const [service, staff, resource] = await Promise.all([
    db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(asc(services.id))
      .limit(1),
    db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.businessId, businessId))
      .orderBy(asc(staffMembers.id))
      .limit(1),
    db
      .select()
      .from(resources)
      .where(eq(resources.businessId, businessId))
      .orderBy(asc(resources.id))
      .limit(1),
  ]);
  if (!service[0] || !staff[0] || !resource[0]) return;
  const tomorrow = new Date(Date.now() + DAY);
  const startsAt = Date.UTC(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate(),
    9,
    0
  );
  const bookingReference = buildBookingReference();
  const insert = await db
    .insert(appointments)
    .values({
      businessId,
      serviceId: service[0].id,
      staffId: staff[0].id,
      resourceId: resource[0].id,
      customerName: "Amina Hassan",
      customerEmail: "amina@example.com",
      customerPhone: "+254700100200",
      startsAt,
      endsAt: startsAt + service[0].durationMinutes * 60_000,
      status: "confirmed",
      totalCents: service[0].priceCents,
      depositCents: service[0].depositCents,
      paymentStatus: "paid",
      bookingReference,
    });
  await db
    .insert(depositPayments)
    .values({
      appointmentId: Number(insert[0].insertId),
      providerReference: buildSimulatedMpesaReference(),
      phone: "+254700100200",
      amountCents: service[0].depositCents,
      status: "paid",
      requestedAt: startsAt - DAY,
      completedAt: startsAt - DAY,
    });
}

export async function createDemoWorkspace(ownerId: number) {
  const existing = await getBusinessByOwner(ownerId);
  if (existing) {
    await seedBusinessData(existing.id);
    return existing;
  }
  const db = await database();
  const shortId = String(ownerId).padStart(4, "0");
  await db.insert(businesses).values({
    ownerId,
    name: "Atelier Nia",
    bookingSlug: `atelier-nia-${shortId}`,
    timezone: "Africa/Nairobi",
    currency: "KES",
  });
  const created = await getBusinessByOwner(ownerId);
  if (!created) throw new Error("Could not create your demo workspace.");
  await seedBusinessData(created.id);
  return created;
}

export async function ensurePublicDemoBusiness() {
  const existing = await getBusinessBySlug(DEMO_SLUG);
  if (existing) {
    await seedBusinessData(existing.id);
    return existing;
  }
  const db = await database();
  const demoOpenId = "slotflow-public-demo";
  let demoUser = (
    await db.select().from(users).where(eq(users.openId, demoOpenId)).limit(1)
  )[0];
  if (!demoUser) {
    await db
      .insert(users)
      .values({
        openId: demoOpenId,
        name: "SlotFlow Demo",
        email: "demo@slotflow.local",
        loginMethod: "system",
        role: "admin",
      });
    demoUser = (
      await db.select().from(users).where(eq(users.openId, demoOpenId)).limit(1)
    )[0];
  }
  if (!demoUser) throw new Error("Could not create the public demo owner.");
  await db
    .insert(businesses)
    .values({
      ownerId: demoUser.id,
      name: "Atelier Nia",
      bookingSlug: DEMO_SLUG,
      timezone: "Africa/Nairobi",
      currency: "KES",
    });
  const business = await getBusinessBySlug(DEMO_SLUG);
  if (!business) throw new Error("Could not create the public demo workspace.");
  await seedBusinessData(business.id);
  return business;
}

export async function getDashboardSnapshot(
  ownerId: number,
  start: number,
  end: number
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) return null;
  return getBusinessSnapshot(business, start, end);
}

export async function getBusinessSnapshot(
  business: typeof businesses.$inferSelect,
  start: number,
  end: number
) {
  const db = await database();
  const [
    serviceRows,
    staffRows,
    resourceRows,
    availabilityRows,
    appointmentRows,
    reminderRows,
    settingsRows,
  ] = await Promise.all([
    db
      .select()
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.name)),
    db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.businessId, business.id))
      .orderBy(asc(staffMembers.name)),
    db
      .select()
      .from(resources)
      .where(eq(resources.businessId, business.id))
      .orderBy(asc(resources.name)),
    db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.businessId, business.id))
      .orderBy(asc(availabilityRules.dayOfWeek)),
    db
      .select({
        id: appointments.id,
        customerName: appointments.customerName,
        customerEmail: appointments.customerEmail,
        customerPhone: appointments.customerPhone,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        paymentStatus: appointments.paymentStatus,
        bookingReference: appointments.bookingReference,
        totalCents: appointments.totalCents,
        depositCents: appointments.depositCents,
        serviceId: appointments.serviceId,
        staffId: appointments.staffId,
        resourceId: appointments.resourceId,
        serviceName: services.name,
        serviceColor: services.color,
        staffName: staffMembers.name,
        staffColor: staffMembers.color,
        resourceName: resources.name,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .innerJoin(staffMembers, eq(appointments.staffId, staffMembers.id))
      .leftJoin(resources, eq(appointments.resourceId, resources.id))
      .where(
        and(
          eq(appointments.businessId, business.id),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end)
        )
      )
      .orderBy(asc(appointments.startsAt)),
    db
      .select({
        id: reminderEvents.id,
        appointmentId: reminderEvents.appointmentId,
        channel: reminderEvents.channel,
        scheduledFor: reminderEvents.scheduledFor,
        sentAt: reminderEvents.sentAt,
        status: reminderEvents.status,
      })
      .from(reminderEvents)
      .innerJoin(
        appointments,
        eq(reminderEvents.appointmentId, appointments.id)
      )
      .where(eq(appointments.businessId, business.id))
      .orderBy(asc(reminderEvents.scheduledFor)),
    db
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.businessId, business.id))
      .limit(1),
  ]);

  const assignments = await db
    .select()
    .from(staffServices)
    .where(
      inArray(
        staffServices.staffId,
        staffRows.map(staff => staff.id)
      )
    );
  return {
    business,
    services: serviceRows,
    staff: staffRows,
    resources: resourceRows,
    availability: availabilityRows,
    appointments: appointmentRows,
    reminders: reminderRows,
    reminderSettings: settingsRows[0] ?? {
      businessId: business.id,
      smsEnabled: true,
      emailEnabled: true,
      leadHours: 24,
    },
    staffServiceAssignments: assignments,
  };
}

export async function getPublicBookingSetup(slug: string) {
  const business =
    slug === DEMO_SLUG
      ? await ensurePublicDemoBusiness()
      : await getBusinessBySlug(slug);
  if (!business) return null;
  const db = await database();
  const [serviceRows, staffRows, resourceRows, assignments] = await Promise.all(
    [
      db
        .select()
        .from(services)
        .where(
          and(eq(services.businessId, business.id), eq(services.active, true))
        )
        .orderBy(asc(services.name)),
      db
        .select()
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.businessId, business.id),
            eq(staffMembers.active, true)
          )
        )
        .orderBy(asc(staffMembers.name)),
      db
        .select()
        .from(resources)
        .where(
          and(eq(resources.businessId, business.id), eq(resources.active, true))
        )
        .orderBy(asc(resources.name)),
      db
        .select({
          staffId: staffServices.staffId,
          serviceId: staffServices.serviceId,
        })
        .from(staffServices)
        .innerJoin(staffMembers, eq(staffServices.staffId, staffMembers.id))
        .where(eq(staffMembers.businessId, business.id)),
    ]
  );
  return {
    business,
    services: serviceRows,
    staff: staffRows,
    resources: resourceRows,
    staffServiceAssignments: assignments,
  };
}

async function verifyBookableSelection({
  businessId,
  serviceId,
  staffId,
  resourceId,
}: {
  businessId: number;
  serviceId: number;
  staffId: number;
  resourceId?: number | null;
}) {
  const db = await database();
  const [service] = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, businessId),
        eq(services.active, true)
      )
    )
    .limit(1);
  if (!service) throw new Error("This service is not currently bookable.");
  const [staff] = await db
    .select()
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.id, staffId),
        eq(staffMembers.businessId, businessId),
        eq(staffMembers.active, true)
      )
    )
    .limit(1);
  if (!staff) throw new Error("This team member is not currently bookable.");
  const assignment = await db
    .select()
    .from(staffServices)
    .where(
      and(
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, serviceId)
      )
    )
    .limit(1);
  if (!assignment.length)
    throw new Error("Please select a team member who offers this service.");
  if (resourceId) {
    const [resource] = await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.businessId, businessId),
          eq(resources.active, true)
        )
      )
      .limit(1);
    if (!resource) throw new Error("This resource is not currently bookable.");
  }
  return { service, staff };
}

async function getBusinessDayWindow(
  businessId: number,
  date: string,
  dateStart: number
) {
  const db = await database();
  const day = dayOfWeekForBusinessDate(date);
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.businessId, businessId),
        eq(availabilityRules.targetType, "business"),
        eq(availabilityRules.dayOfWeek, day),
        eq(availabilityRules.active, true)
      )
    );
  return rules.map(rule => ({
    startsAt: dateStart + rule.startMinute * 60_000,
    endsAt: dateStart + rule.endMinute * 60_000,
  }));
}

async function getTargetDayWindows({
  businessId,
  targetType,
  targetId,
  date,
  dateStart,
}: {
  businessId: number;
  targetType: "staff" | "resource";
  targetId: number;
  date: string;
  dateStart: number;
}) {
  const db = await database();
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.businessId, businessId),
        eq(availabilityRules.targetType, targetType),
        eq(availabilityRules.targetId, targetId),
        eq(availabilityRules.dayOfWeek, dayOfWeekForBusinessDate(date)),
        eq(availabilityRules.active, true)
      )
    );
  return rules.map(rule => ({
    startsAt: dateStart + rule.startMinute * 60_000,
    endsAt: dateStart + rule.endMinute * 60_000,
  }));
}

function intersectWindows(
  base: Array<{ startsAt: number; endsAt: number }>,
  constraint: Array<{ startsAt: number; endsAt: number }>
) {
  return base.flatMap(window =>
    constraint
      .map(rule => ({
        startsAt: Math.max(window.startsAt, rule.startsAt),
        endsAt: Math.min(window.endsAt, rule.endsAt),
      }))
      .filter(window => window.endsAt > window.startsAt)
  );
}

async function getApplicableDayWindows({
  businessId,
  staffId,
  resourceId,
  date,
  dateStart,
}: {
  businessId: number;
  staffId: number;
  resourceId?: number | null;
  date: string;
  dateStart: number;
}) {
  let windows = await getBusinessDayWindow(businessId, date, dateStart);
  const staffWindows = await getTargetDayWindows({
    businessId,
    targetType: "staff",
    targetId: staffId,
    date,
    dateStart,
  });
  if (staffWindows.length) windows = intersectWindows(windows, staffWindows);
  if (resourceId) {
    const resourceWindows = await getTargetDayWindows({
      businessId,
      targetType: "resource",
      targetId: resourceId,
      date,
      dateStart,
    });
    if (resourceWindows.length)
      windows = intersectWindows(windows, resourceWindows);
  }
  return windows;
}

async function getConflictingAppointments(
  {
    staffId,
    resourceId,
    startsAt,
    endsAt,
  }: {
    staffId: number;
    resourceId?: number | null;
    startsAt: number;
    endsAt: number;
  },
  tx?: any
) {
  const db = tx ?? (await database());
  const now = Date.now();
  const notExpired = or(
    ne(appointments.status, "pending"),
    isNull(appointments.expiresAt),
    gt(appointments.expiresAt, now)
  );
  const baseCondition = and(
    lt(appointments.startsAt, endsAt),
    gte(appointments.endsAt, startsAt),
    ne(appointments.status, "cancelled"),
    notExpired
  );
  const condition = resourceId
    ? and(
        baseCondition,
        or(
          eq(appointments.staffId, staffId),
          eq(appointments.resourceId, resourceId)
        )
      )
    : and(baseCondition, eq(appointments.staffId, staffId));
  return db
    .select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(condition);
}

export async function getAvailableSlots({
  slug,
  serviceId,
  staffId,
  resourceId,
  date,
}: {
  slug: string;
  serviceId: number;
  staffId: number;
  resourceId?: number | null;
  date: string;
}) {
  const business =
    slug === DEMO_SLUG
      ? await ensurePublicDemoBusiness()
      : await getBusinessBySlug(slug);
  if (!business) throw new Error("This booking page is unavailable.");
  const { service } = await verifyBookableSelection({
    businessId: business.id,
    serviceId,
    staffId,
    resourceId,
  });
  const dateStart = businessDateStartUtc(date, business.timezone);
  const windows = await getApplicableDayWindows({
    businessId: business.id,
    staffId,
    resourceId,
    date,
    dateStart,
  });
  const occupied = await getConflictingAppointments({
    staffId,
    resourceId,
    startsAt: dateStart,
    endsAt: dateStart + DAY,
  });
  return windows.flatMap(window =>
    buildAvailableSlotStarts({
      windowStart: window.startsAt,
      windowEnd: window.endsAt,
      durationMinutes: service.durationMinutes,
      occupied: occupied as Array<{
        startsAt: number;
        endsAt: number;
        status: AppointmentState;
      }>,
    })
  );
}

export async function createPublicAppointment(input: {
  slug: string;
  serviceId: number;
  staffId: number;
  resourceId?: number | null;
  startsAt: number;
  bookingDate: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
  notes?: string | null;
}) {
  const business =
    input.slug === DEMO_SLUG
      ? await ensurePublicDemoBusiness()
      : await getBusinessBySlug(input.slug);
  if (!business) throw new Error("This booking page is unavailable.");
  const { service } = await verifyBookableSelection({
    businessId: business.id,
    serviceId: input.serviceId,
    staffId: input.staffId,
    resourceId: input.resourceId,
  });
  const endsAt = input.startsAt + service.durationMinutes * 60_000;
  if (
    businessDateForTimestamp(input.startsAt, business.timezone) !==
    input.bookingDate
  )
    throw new Error(
      "Please select an available time for the chosen booking date."
    );
  const allowedSlots = await getAvailableSlots({
    slug: business.bookingSlug,
    serviceId: input.serviceId,
    staffId: input.staffId,
    resourceId: input.resourceId,
    date: input.bookingDate,
  });
  const db = await database();
  const lockName = `sf_res_${business.id}_${input.staffId}_${input.resourceId || 0}_${input.startsAt}`;

  return await db.transaction(async tx => {
    let lockAcquired = false;
    try {
      const [rawLockRows] = await tx.execute(
        sql`SELECT GET_LOCK(${lockName}, 5) AS acquired`
      );
      const lockRows = rawLockRows as unknown as Array<{
        acquired: number | null;
      }>;
      lockAcquired = Number(lockRows[0]?.acquired ?? 0) === 1;
      if (!lockAcquired) {
        throw new Error(
          "The booking service is busy. Please retry this time in a moment."
        );
      }

      const conflicts = await getConflictingAppointments(
        {
          staffId: input.staffId,
          resourceId: input.resourceId,
          startsAt: input.startsAt,
          endsAt,
        },
        tx
      );
      if (
        hasSchedulingConflict(
          { startsAt: input.startsAt, endsAt },
          conflicts as Array<{
            startsAt: number;
            endsAt: number;
            status: AppointmentState;
          }>
        )
      ) {
        throw new Error(
          "That time is no longer available. Please select another time."
        );
      }

      const bookingReference = buildBookingReference();
      const expiresAt = Date.now() + 15 * 60_000;
      const insert = await tx.insert(appointments).values({
        businessId: business.id,
        serviceId: input.serviceId,
        staffId: input.staffId,
        resourceId: input.resourceId ?? null,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        customerPhone: sanitizePhone(input.customerPhone),
        startsAt: input.startsAt,
        endsAt,
        status: "pending",
        totalCents: service.priceCents,
        depositCents: service.depositCents,
        paymentStatus: "pending",
        bookingReference,
        notes: input.notes?.trim() || null,
        expiresAt,
      });
      const appointmentId = Number(insert[0].insertId);
      const providerReference = buildSimulatedMpesaReference();
      await tx
        .insert(depositPayments)
        .values({
          appointmentId,
          providerReference,
          phone: sanitizePhone(input.customerPhone),
          amountCents: service.depositCents,
          status: "pending",
          requestedAt: Date.now(),
        });
      const settings = await getReminderSettingsForBusiness(business.id);
      const scheduledFor = input.startsAt - settings.leadHours * 60 * 60_000;
      const reminderPlans = [
        ...(settings.smsEnabled
          ? [{ appointmentId, channel: "sms" as const, scheduledFor }]
          : []),
        ...(settings.emailEnabled && input.customerEmail
          ? [{ appointmentId, channel: "email" as const, scheduledFor }]
          : []),
      ];
      if (reminderPlans.length)
        await tx.insert(reminderEvents).values(reminderPlans);

      return {
        appointmentId,
        bookingReference,
        providerReference,
        depositCents: service.depositCents,
        paymentStatus: "pending" as const,
        appointmentStatus: "pending" as const,
      };
    } finally {
      if (lockAcquired) {
        await tx.execute(sql`SELECT RELEASE_LOCK(${lockName})`);
      }
    }
  });
}

export async function completeSimulatedPayment(
  providerReference: string,
  outcome: "paid" | "failed"
) {
  const db = await database();
  const [payment] = await db
    .select()
    .from(depositPayments)
    .where(eq(depositPayments.providerReference, providerReference))
    .limit(1);
  if (!payment)
    throw new Error("This simulated payment request was not found.");
  if (payment.status !== "pending")
    throw new Error("This simulated payment has already been completed.");
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, payment.appointmentId))
    .limit(1);
  if (!appointment) throw new Error("The linked appointment was not found.");
  if (
    appointment.status === "pending" &&
    appointment.expiresAt &&
    appointment.expiresAt < Date.now()
  ) {
    throw new Error("This booking request has expired.");
  }
  const now = Date.now();
  await db
    .update(depositPayments)
    .set({ status: outcome, completedAt: now })
    .where(eq(depositPayments.id, payment.id));
  await db
    .update(appointments)
    .set({
      status: outcome === "paid" ? "paid" : "pending",
      paymentStatus: outcome,
    })
    .where(eq(appointments.id, payment.appointmentId));
  return {
    bookingReference: appointment.bookingReference,
    paymentStatus: outcome,
    appointmentStatus: appointment.status,
  };
}

export async function retrySimulatedPayment(providerReference: string) {
  const db = await database();
  const [payment] = await db
    .select()
    .from(depositPayments)
    .where(eq(depositPayments.providerReference, providerReference))
    .limit(1);
  if (!payment)
    throw new Error("This simulated payment request was not found.");
  if (payment.status !== "failed")
    throw new Error("Only a failed simulated payment can be retried.");
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, payment.appointmentId))
    .limit(1);
  if (!appointment) throw new Error("The linked appointment was not found.");
  if (
    appointment.status === "pending" &&
    appointment.expiresAt &&
    appointment.expiresAt < Date.now()
  ) {
    throw new Error("This booking request has expired.");
  }
  const nextReference = buildSimulatedMpesaReference();
  await db
    .insert(depositPayments)
    .values({
      appointmentId: payment.appointmentId,
      providerReference: nextReference,
      phone: payment.phone,
      amountCents: payment.amountCents,
      status: "pending",
      requestedAt: Date.now(),
    });
  await db
    .update(appointments)
    .set({ status: "pending", paymentStatus: "pending" })
    .where(eq(appointments.id, payment.appointmentId));
  return {
    providerReference: nextReference,
    bookingReference: appointment.bookingReference,
    depositCents: payment.amountCents,
  };
}

export async function updateAppointmentState(
  ownerId: number,
  appointmentId: number,
  status: AppointmentState
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing appointments.");
  const db = await database();
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.businessId, business.id)
      )
    )
    .limit(1);
  if (!appointment) throw new Error("Appointment not found.");
  if (!canTransitionAppointment(appointment.status, status))
    throw new Error("That appointment transition is not allowed.");
  await db
    .update(appointments)
    .set({ status })
    .where(eq(appointments.id, appointmentId));
  if (status === "cancelled") {
    await db
      .update(reminderEvents)
      .set({ status: "cancelled" })
      .where(eq(reminderEvents.appointmentId, appointmentId));
  }
  return { success: true } as const;
}

export async function createService(
  ownerId: number,
  input: {
    name: string;
    description?: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number;
    color: string;
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before adding services.");
  const db = await database();
  await db
    .insert(services)
    .values({ businessId: business.id, ...input, active: true });
  return { success: true } as const;
}

export async function createStaffMember(
  ownerId: number,
  input: {
    name: string;
    roleTitle?: string;
    email?: string;
    phone?: string;
    color: string;
    serviceIds: number[];
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before adding staff.");
  const db = await database();
  const created = await db
    .insert(staffMembers)
    .values({
      businessId: business.id,
      name: input.name,
      roleTitle: input.roleTitle || null,
      email: input.email || null,
      phone: input.phone || null,
      color: input.color,
      active: true,
    });
  const staffId = Number(created[0].insertId);
  if (input.serviceIds.length)
    await db
      .insert(staffServices)
      .values(input.serviceIds.map(serviceId => ({ staffId, serviceId })));
  return { success: true } as const;
}

export async function createResource(
  ownerId: number,
  input: { name: string; resourceType: string; capacity: number }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before adding resources.");
  const db = await database();
  await db
    .insert(resources)
    .values({ businessId: business.id, ...input, active: true });
  return { success: true } as const;
}

export async function saveBusinessAvailability(
  ownerId: number,
  input: {
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    active: boolean;
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before adding availability.");
  const db = await database();
  const condition = and(
    eq(availabilityRules.businessId, business.id),
    eq(availabilityRules.targetType, "business"),
    eq(availabilityRules.dayOfWeek, input.dayOfWeek)
  );
  if (!input.active)
    await db.update(availabilityRules).set({ active: false }).where(condition);
  else
    await db
      .insert(availabilityRules)
      .values({ businessId: business.id, targetType: "business", ...input });
  return { success: true } as const;
}

export async function setServiceActive(
  ownerId: number,
  serviceId: number,
  active: boolean
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing services.");
  const db = await database();
  await db
    .update(services)
    .set({ active })
    .where(
      and(eq(services.id, serviceId), eq(services.businessId, business.id))
    );
  return { success: true } as const;
}

export async function setStaffActive(
  ownerId: number,
  staffId: number,
  active: boolean
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before managing staff.");
  const db = await database();
  await db
    .update(staffMembers)
    .set({ active })
    .where(
      and(
        eq(staffMembers.id, staffId),
        eq(staffMembers.businessId, business.id)
      )
    );
  return { success: true } as const;
}

export async function setResourceActive(
  ownerId: number,
  resourceId: number,
  active: boolean
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing resources.");
  const db = await database();
  await db
    .update(resources)
    .set({ active })
    .where(
      and(eq(resources.id, resourceId), eq(resources.businessId, business.id))
    );
  return { success: true } as const;
}

export async function renameService(
  ownerId: number,
  serviceId: number,
  name: string
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing services.");
  const db = await database();
  await db
    .update(services)
    .set({ name })
    .where(
      and(eq(services.id, serviceId), eq(services.businessId, business.id))
    );
  return { success: true } as const;
}

export async function renameStaffMember(
  ownerId: number,
  staffId: number,
  name: string
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before managing staff.");
  const db = await database();
  await db
    .update(staffMembers)
    .set({ name })
    .where(
      and(
        eq(staffMembers.id, staffId),
        eq(staffMembers.businessId, business.id)
      )
    );
  return { success: true } as const;
}

export async function renameResource(
  ownerId: number,
  resourceId: number,
  name: string
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing resources.");
  const db = await database();
  await db
    .update(resources)
    .set({ name })
    .where(
      and(eq(resources.id, resourceId), eq(resources.businessId, business.id))
    );
  return { success: true } as const;
}

export async function addTargetAvailability(
  ownerId: number,
  input: {
    targetType: "staff" | "resource";
    targetId: number;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before adding availability.");
  const db = await database();
  if (input.targetType === "staff") {
    const [staff] = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, input.targetId),
          eq(staffMembers.businessId, business.id)
        )
      )
      .limit(1);
    if (!staff)
      throw new Error("That team member is not part of your workspace.");
  } else {
    const [resource] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.id, input.targetId),
          eq(resources.businessId, business.id)
        )
      )
      .limit(1);
    if (!resource)
      throw new Error("That resource is not part of your workspace.");
  }
  await db
    .insert(availabilityRules)
    .values({ businessId: business.id, ...input, active: true });
  return { success: true } as const;
}

export async function updateService(
  ownerId: number,
  input: {
    serviceId: number;
    name: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number;
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing services.");
  const db = await database();
  await db
    .update(services)
    .set({
      name: input.name,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      depositCents: input.depositCents,
    })
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.businessId, business.id)
      )
    );
  return { success: true } as const;
}

export async function updateStaffMember(
  ownerId: number,
  input: {
    staffId: number;
    name: string;
    roleTitle?: string;
    email?: string;
    phone?: string;
    serviceIds: number[];
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business) throw new Error("Set up a workspace before managing staff.");
  const db = await database();
  const [staff] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.id, input.staffId),
        eq(staffMembers.businessId, business.id)
      )
    )
    .limit(1);
  if (!staff)
    throw new Error("That team member is not part of your workspace.");
  if (input.serviceIds.length) {
    const availableServices = await db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.businessId, business.id),
          inArray(services.id, input.serviceIds)
        )
      );
    if (availableServices.length !== input.serviceIds.length)
      throw new Error("One or more services are not part of your workspace.");
  }
  await db
    .update(staffMembers)
    .set({
      name: input.name,
      roleTitle: input.roleTitle || null,
      email: input.email || null,
      phone: input.phone || null,
    })
    .where(eq(staffMembers.id, input.staffId));
  await db
    .delete(staffServices)
    .where(eq(staffServices.staffId, input.staffId));
  if (input.serviceIds.length)
    await db
      .insert(staffServices)
      .values(
        input.serviceIds.map(serviceId => ({
          staffId: input.staffId,
          serviceId,
        }))
      );
  return { success: true } as const;
}

export async function updateResource(
  ownerId: number,
  input: {
    resourceId: number;
    name: string;
    resourceType: string;
    capacity: number;
  }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before managing resources.");
  const db = await database();
  await db
    .update(resources)
    .set({
      name: input.name,
      resourceType: input.resourceType,
      capacity: input.capacity,
    })
    .where(
      and(
        eq(resources.id, input.resourceId),
        eq(resources.businessId, business.id)
      )
    );
  return { success: true } as const;
}

async function markReminderEventsSent(
  businessId: number,
  scheduledBefore: number,
  limit: number
) {
  const db = await database();
  const due = await db
    .select({ id: reminderEvents.id })
    .from(reminderEvents)
    .innerJoin(appointments, eq(reminderEvents.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.businessId, businessId),
        inArray(appointments.status, REMINDABLE_APPOINTMENT_STATES),
        eq(reminderEvents.status, "scheduled"),
        lte(reminderEvents.scheduledFor, scheduledBefore)
      )
    )
    .orderBy(asc(reminderEvents.scheduledFor))
    .limit(limit);
  const now = Date.now();
  for (const reminder of due) {
    await db
      .update(reminderEvents)
      .set({ status: "simulated_sent", sentAt: now })
      .where(
        and(
          eq(reminderEvents.id, reminder.id),
          eq(reminderEvents.status, "scheduled")
        )
      );
  }
  return due.length;
}

export async function simulateNextReminderBatch(ownerId: number) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before simulating reminders.");
  const db = await database();
  const next = await db
    .select({ scheduledFor: reminderEvents.scheduledFor })
    .from(reminderEvents)
    .innerJoin(appointments, eq(reminderEvents.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.businessId, business.id),
        inArray(appointments.status, REMINDABLE_APPOINTMENT_STATES),
        eq(reminderEvents.status, "scheduled")
      )
    )
    .orderBy(asc(reminderEvents.scheduledFor))
    .limit(1);
  if (!next[0])
    return { processed: 0, message: "No scheduled reminders are waiting." };
  const processed = await markReminderEventsSent(
    business.id,
    next[0].scheduledFor,
    10
  );
  return {
    processed,
    message: `${processed} simulated reminder${processed === 1 ? "" : "s"} logged.`,
  };
}

export async function runDueReminderSimulation(taskUid: string) {
  const db = await database();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.scheduleCronTaskUid, taskUid))
    .limit(1);
  if (!business) return { processed: 0, skipped: "orphan" as const };
  const processed = await markReminderEventsSent(business.id, Date.now(), 100);
  return { processed, skipped: null };
}

export async function setReminderScheduleTask(
  ownerId: number,
  taskUid: string
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before activating reminders.");
  const db = await database();
  await db
    .update(businesses)
    .set({ scheduleCronTaskUid: taskUid })
    .where(eq(businesses.id, business.id));
  return { businessId: business.id };
}

async function getReminderSettingsForBusiness(businessId: number) {
  const db = await database();
  const [settings] = await db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.businessId, businessId))
    .limit(1);
  return (
    settings ?? {
      businessId,
      smsEnabled: true,
      emailEnabled: true,
      leadHours: 24,
    }
  );
}

export async function updateReminderSettings(
  ownerId: number,
  input: { smsEnabled: boolean; emailEnabled: boolean; leadHours: number }
) {
  const business = await getBusinessByOwner(ownerId);
  if (!business)
    throw new Error("Set up a workspace before configuring reminders.");
  const db = await database();
  await db
    .insert(reminderSettings)
    .values({ businessId: business.id, ...input })
    .onDuplicateKeyUpdate({ set: input });
  return { success: true } as const;
}
