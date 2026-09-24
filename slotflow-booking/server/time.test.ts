import { describe, expect, it } from "vitest";
import {
  businessDateForTimestamp,
  businessDateStartUtc,
  dayOfWeekForBusinessDate,
} from "./time";
import { buildAvailableSlotStarts } from "./booking";

describe("business timezone date boundaries", () => {
  it("maps a Nairobi calendar date to the correct UTC start instant", () => {
    const start = businessDateStartUtc("2026-08-28", "Africa/Nairobi");
    expect(new Date(start).toISOString()).toBe("2026-08-27T21:00:00.000Z");
    expect(businessDateForTimestamp(start + 3_600_000, "Africa/Nairobi")).toBe(
      "2026-08-28"
    );
  });

  it("uses the expected weekday for a business booking date", () => {
    expect(dayOfWeekForBusinessDate("2026-08-28")).toBe(5);
  });
});

describe("slot conflict guard", () => {
  it("omits a time that overlaps an existing resource reservation", () => {
    const hour = 3_600_000;
    const slots = buildAvailableSlotStarts({
      windowStart: 9 * hour,
      windowEnd: 13 * hour,
      durationMinutes: 60,
      occupied: [{ startsAt: 10 * hour, endsAt: 11 * hour, status: "pending" }],
    });
    expect(slots).toEqual([
      9 * hour,
      11 * hour,
      Math.floor(11.5 * hour),
      12 * hour,
    ]);
  });
});
