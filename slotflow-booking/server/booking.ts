import { nanoid } from "nanoid";

export type AppointmentState =
  | "pending"
  | "paid"
  | "confirmed"
  | "cancelled"
  | "completed";

export type TimeRange = {
  startsAt: number;
  endsAt: number;
};

export const REMINDABLE_APPOINTMENT_STATES = ["paid", "confirmed"] as const;

export function rangesOverlap(left: TimeRange, right: TimeRange): boolean {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}

export function hasSchedulingConflict(
  candidate: TimeRange,
  existing: Array<TimeRange & { status: AppointmentState }>
): boolean {
  return existing.some(
    appointment =>
      appointment.status !== "cancelled" &&
      rangesOverlap(candidate, appointment)
  );
}

export function buildAvailableSlotStarts({
  windowStart,
  windowEnd,
  durationMinutes,
  incrementMinutes = 30,
  occupied,
}: {
  windowStart: number;
  windowEnd: number;
  durationMinutes: number;
  incrementMinutes?: number;
  occupied: Array<TimeRange & { status: AppointmentState }>;
}): number[] {
  const slotLength = durationMinutes * 60_000;
  const increment = incrementMinutes * 60_000;
  const slots: number[] = [];

  for (
    let startsAt = windowStart;
    startsAt + slotLength <= windowEnd;
    startsAt += increment
  ) {
    if (
      !hasSchedulingConflict(
        { startsAt, endsAt: startsAt + slotLength },
        occupied
      )
    ) {
      slots.push(startsAt);
    }
  }

  return slots;
}

const transitions: Record<AppointmentState, AppointmentState[]> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

export function canTransitionAppointment(
  from: AppointmentState,
  to: AppointmentState
): boolean {
  return transitions[from].includes(to);
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^0/, "+254");
}

export function buildBookingReference(): string {
  return `SF-${nanoid(12)}`;
}

export function buildSimulatedMpesaReference(): string {
  return `SIM-MPESA-${nanoid(16)}`;
}
