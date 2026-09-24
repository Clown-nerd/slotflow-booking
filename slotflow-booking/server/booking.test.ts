import { describe, expect, it } from "vitest";
import {
  buildAvailableSlotStarts,
  canTransitionAppointment,
  hasSchedulingConflict,
  REMINDABLE_APPOINTMENT_STATES,
  sanitizePhone,
  buildBookingReference,
  buildSimulatedMpesaReference,
} from "./booking";

describe("booking availability", () => {
  const hour = 60 * 60 * 1000;

  it("treats overlapping staff or resource time as a conflict", () => {
    expect(
      hasSchedulingConflict({ startsAt: 10 * hour, endsAt: 11 * hour }, [
        {
          startsAt: Math.floor(10.5 * hour),
          endsAt: Math.floor(11.5 * hour),
          status: "confirmed",
        },
      ])
    ).toBe(true);
  });

  it("releases a cancelled booking and excludes conflicting slots", () => {
    expect(
      buildAvailableSlotStarts({
        windowStart: 9 * hour,
        windowEnd: 12 * hour,
        durationMinutes: 60,
        occupied: [
          { startsAt: 10 * hour, endsAt: 11 * hour, status: "confirmed" },
          { startsAt: 11 * hour, endsAt: 12 * hour, status: "cancelled" },
        ],
      })
    ).toEqual([9 * hour, 11 * hour]);
  });
});

describe("appointment lifecycle", () => {
  it("allows valid payment-to-confirmation transitions and rejects terminal changes", () => {
    expect(canTransitionAppointment("pending", "paid")).toBe(true);
    expect(canTransitionAppointment("paid", "confirmed")).toBe(true);
    expect(canTransitionAppointment("completed", "confirmed")).toBe(false);
  });

  it("normalizes common Kenyan local phone input", () => {
    expect(sanitizePhone("0712 345 678")).toBe("+254712345678");
  });

  it("selects only payment-secured appointments for reminders", () => {
    expect(REMINDABLE_APPOINTMENT_STATES).toEqual(["paid", "confirmed"]);
    expect(REMINDABLE_APPOINTMENT_STATES).not.toContain("pending");
    expect(REMINDABLE_APPOINTMENT_STATES).not.toContain("cancelled");
  });
});

describe("identifier generation", () => {
  it("generates correctly prefixed and unique booking references", () => {
    const refs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const ref = buildBookingReference();
      expect(ref.startsWith("SF-")).toBe(true);
      refs.add(ref);
    }
    expect(refs.size).toBe(1000);
  });

  it("generates correctly prefixed and unique payment references", () => {
    const refs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const ref = buildSimulatedMpesaReference();
      expect(ref.startsWith("SIM-MPESA-")).toBe(true);
      refs.add(ref);
    }
    expect(refs.size).toBe(1000);
  });
});
