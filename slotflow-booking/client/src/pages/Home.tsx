import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { addDays, format, startOfDay } from "date-fns";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Coffee,
  Copy,
  ExternalLink,
  Plus,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const HOUR_HEIGHT = 74;
const OPENING_HOUR = 8;

type CalendarMode = "staff" | "resource";

function money(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(value / 100);
}

function dayStartUtc(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function stateTone(status: string) {
  if (status === "confirmed")
    return "bg-[#E3E8D7] text-[#40502F] border-[#C9D4B3]";
  if (status === "paid") return "bg-[#F5E7D8] text-[#895B3A] border-[#E8CFB5]";
  if (status === "completed")
    return "bg-[#E8EDF0] text-[#4D606B] border-[#D4DFE3]";
  if (status === "cancelled")
    return "bg-[#F5E4E2] text-[#9B4A43] border-[#E9CBC6]";
  return "bg-[#EEECE7] text-[#665F56] border-[#DEDAD3]";
}

export default function Home() {
  return (
    <DashboardLayout allowDemo>
      <OperationsDashboard />
    </DashboardLayout>
  );
}

function OperationsDashboard() {
  const [, setLocation] = useLocation();
  const [range] = useState(() => {
    const start = dayStartUtc(startOfDay(new Date()));
    return { start, end: start + 8 * 86_400_000 };
  });
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("staff");
  const [calendarScope, setCalendarScope] = useState<"day" | "week">("week");
  const [selectedMember, setSelectedMember] = useState<number | "all">("all");
  const { data, isLoading, error } = trpc.booking.demoDashboard.useQuery(range);

  const metrics = useMemo(() => {
    const rows = data?.appointments ?? [];
    return {
      confirmed: rows.filter(item => item.status === "confirmed").length,
      deposits: rows
        .filter(item => item.paymentStatus === "paid")
        .reduce((sum, item) => sum + item.depositCents, 0),
      revenue: rows
        .filter(item => item.status !== "cancelled")
        .reduce((sum, item) => sum + item.totalCents, 0),
    };
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data)
    return <DashboardError onRetry={() => window.location.reload()} />;

  const activeItems = calendarMode === "staff" ? data.staff : data.resources;
  const visibleItems =
    selectedMember === "all"
      ? activeItems
      : activeItems.filter(item => item.id === selectedMember);
  const days =
    calendarScope === "day"
      ? [addDays(new Date(range.start), 1)]
      : Array.from({ length: 5 }, (_, index) =>
          addDays(new Date(range.start), index)
        );

  return (
    <div className="mx-auto max-w-[1480px]">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-border/80 pb-6 sm:flex-row sm:items-end">
        <div className="pl-8 lg:pl-10">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Atelier Nia · Demo workspace
            </p>
          </div>
          <h1 className="font-display mt-2 text-[2.2rem] leading-none tracking-[-0.04em] sm:text-5xl">
            Good morning, the day is yours.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            See where your attention is needed, then let your calendar carry the
            detail.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:pb-0.5">
          <Button
            variant="outline"
            onClick={() => setLocation("/book/slotflow-studio")}
            className="pressable h-10 rounded-xl border-border bg-card px-4 text-xs font-semibold hover:bg-secondary"
          >
            <ExternalLink className="mr-2 size-3.5" />
            Booking page
          </Button>
          <Button
            onClick={() => setLocation("/book/slotflow-studio")}
            className="pressable h-10 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1.5 size-4" />
            New booking
          </Button>
        </div>
      </header>

      <section
        aria-label="Booking overview"
        className="grid gap-3 md:grid-cols-3"
      >
        <MetricCard
          icon={CalendarDays}
          label="Secured bookings"
          value={`${metrics.confirmed}`}
          detail="Confirmed appointments in view"
          accent="olive"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Deposits collected"
          value={money(metrics.deposits)}
          detail="Across paid and confirmed bookings"
          accent="clay"
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Expected revenue"
          value={money(metrics.revenue)}
          detail="From active appointments in view"
          accent="slate"
        />
      </section>

      <section
        id="calendar"
        className="surface-card mt-7 scroll-mt-6 overflow-hidden rounded-[1.4rem]"
      >
        <div className="flex flex-col gap-5 border-b border-border/80 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <h2 className="font-display text-2xl tracking-tight">
                The working week
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {calendarScope === "day"
                ? format(days[0]!, "EEEE, d MMMM")
                : `${format(days[0]!, "EEE, d MMM")} — ${format(days[4]!, "EEE, d MMM")}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border bg-background p-1">
              <button
                onClick={() => {
                  setCalendarMode("staff");
                  setSelectedMember("all");
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  calendarMode === "staff"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                By staff
              </button>
              <button
                onClick={() => {
                  setCalendarMode("resource");
                  setSelectedMember("all");
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  calendarMode === "resource"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                By resource
              </button>
            </div>
            <div className="rounded-xl border border-border bg-background p-1">
              <button
                onClick={() => setCalendarScope("day")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  calendarScope === "day"
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Day
              </button>
              <button
                onClick={() => setCalendarScope("week")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  calendarScope === "week"
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Week
              </button>
            </div>
            <select
              aria-label={`Filter by ${calendarMode}`}
              value={selectedMember}
              onChange={event =>
                setSelectedMember(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value)
                )
              }
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">
                All {calendarMode === "staff" ? "team" : "resources"}
              </option>
              {activeItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="hidden items-center rounded-xl border border-border bg-background sm:flex">
              <button
                aria-label="Previous week"
                className="grid size-9 place-items-center rounded-l-xl hover:bg-secondary"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="border-x border-border px-3 text-xs font-semibold">
                This week
              </span>
              <button
                aria-label="Next week"
                className="grid size-9 place-items-center rounded-r-xl hover:bg-secondary"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {calendarScope === "day" ? (
            <LaneCalendar
              items={visibleItems}
              appointments={data.appointments}
              mode={calendarMode}
              dayStart={dayStartUtc(days[0]!)}
            />
          ) : (
            <WeekLaneCalendar
              items={visibleItems}
              appointments={data.appointments}
              mode={calendarMode}
              days={days}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/70 px-5 py-3.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#71805B]" />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#B27B58]" />
              Paid, awaiting confirmation
            </span>
          </div>
          <p className="font-mono uppercase tracking-[0.1em]">
            09:00 — 18:00 · Africa/Nairobi
          </p>
        </div>
      </section>

      <section
        id="operations"
        className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]"
      >
        <div className="surface-card rounded-[1.4rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Operations
              </p>
              <h2 className="font-display mt-1 text-2xl tracking-tight">
                The details behind a smooth day.
              </h2>
            </div>
            <button
              onClick={() =>
                document
                  .getElementById("calendar")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="text-xs font-semibold text-primary underline decoration-primary/35 underline-offset-4"
            >
              View calendar
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <OperationCard
              icon={Coffee}
              eyebrow="Services"
              title={`${data.services.length} bookable rituals`}
              description="Durations, prices, and deposits stay clear at every step."
            />
            <OperationCard
              icon={Users}
              eyebrow="Team"
              title={`${data.staff.length} specialists`}
              description="Each person’s expertise and availability guide selections."
            />
            <OperationCard
              icon={Wrench}
              eyebrow="Resources"
              title={`${data.resources.length} shared spaces`}
              description="Quiet safeguards stop double-booking before it starts."
            />
          </div>
          <div className="mt-5 rounded-2xl border border-border/80 bg-secondary/45 p-4 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                Your public booking page is ready to share.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Customers choose an available time, make a simulated deposit,
                and receive a clear confirmation.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/book/slotflow-studio`
                );
              }}
              className="pressable mt-3 h-9 rounded-xl border-border bg-card text-xs sm:mt-0"
            >
              <Copy className="mr-2 size-3.5" />
              Copy link
            </Button>
          </div>
        </div>
        <aside className="surface-card rounded-[1.4rem] p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Attention needed
          </p>
          <h2 className="font-display mt-1 text-2xl tracking-tight">Next up</h2>
          <div className="mt-4 space-y-3">
            {data.appointments.slice(0, 3).map(appointment => (
              <div
                key={appointment.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 p-3"
              >
                <div
                  className="grid size-9 place-items-center rounded-xl"
                  style={{
                    backgroundColor: `${appointment.serviceColor}20`,
                    color: appointment.serviceColor,
                  }}
                >
                  <CalendarDays className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {appointment.customerName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {appointment.serviceName} ·{" "}
                    {format(new Date(appointment.startsAt), "EEE, HH:mm")}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "border px-2 py-0.5 text-[10px] font-semibold capitalize",
                    stateTone(appointment.status)
                  )}
                >
                  {appointment.status}
                </Badge>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocation("/book/slotflow-studio")}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
          >
            Open booking experience <ArrowUpRight className="size-3.5" />
          </button>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail: string;
  accent: "olive" | "clay" | "slate";
}) {
  const styles = {
    olive: "bg-[#E3E8D7] text-[#40502F]",
    clay: "bg-[#F5E7D8] text-[#895B3A]",
    slate: "bg-[#E8EDF0] text-[#4D606B]",
  };
  return (
    <article className="surface-card flex items-start justify-between rounded-[1.25rem] p-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-display text-3xl tracking-[-0.04em]">{value}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <div
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          styles[accent]
        )}
      >
        <Icon className="size-4" />
      </div>
    </article>
  );
}

function OperationCard({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Users;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-background/65 p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}

function TimeRuler() {
  return (
    <div className="relative border-r border-border/80 bg-background/45">
      {Array.from({ length: 11 }, (_, index) => (
        <span
          key={index}
          className="absolute right-3 -translate-y-1/2 font-mono text-[10px] text-muted-foreground"
          style={{ top: `${index * HOUR_HEIGHT}px` }}
        >
          {String(OPENING_HOUR + index).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}

function CalendarColumn({ dayStart }: { dayStart: number }) {
  return (
    <div className="relative border-l border-border/70 bg-card/20">
      {Array.from({ length: 11 }, (_, index) => (
        <div
          key={index}
          className="border-t border-dashed border-border/60"
          style={{ height: `${HOUR_HEIGHT}px` }}
        />
      ))}
      <div
        className="absolute inset-x-0 top-0 bottom-0 bg-[linear-gradient(to_right,transparent_49.5%,oklch(0.87_0.014_78_/_35%)_50%,transparent_50.5%)] opacity-30"
        aria-hidden
      />{" "}
      <span className="sr-only">
        Calendar column for {format(new Date(dayStart), "EEEE")}
      </span>
    </div>
  );
}

function LaneCalendar({
  items,
  appointments,
  mode,
  dayStart,
}: {
  items: Array<{ id: number; name: string; color?: string }>;
  appointments: Array<{
    id: number;
    staffId: number;
    resourceId: number | null;
    startsAt: number;
    endsAt: number;
    customerName: string;
    serviceName: string;
    staffName: string;
    resourceName: string | null;
    serviceColor: string;
    status: string;
  }>;
  mode: CalendarMode;
  dayStart: number;
}) {
  const dayEnd = dayStart + 86_400_000;
  const laneAppointments = (id: number) =>
    appointments.filter(
      appointment =>
        appointment.startsAt >= dayStart &&
        appointment.startsAt < dayEnd &&
        (mode === "staff"
          ? appointment.staffId === id
          : appointment.resourceId === id)
    );
  const isConflict = (
    appointment: { id: number; startsAt: number; endsAt: number },
    inLane: Array<{ id: number; startsAt: number; endsAt: number }>
  ) =>
    inLane.some(
      other =>
        other.id !== appointment.id &&
        appointment.startsAt < other.endsAt &&
        appointment.endsAt > other.startsAt
    );
  return (
    <div className="min-w-[940px] bg-background/30">
      <div className="grid grid-cols-[200px_1fr] border-b border-border/80 bg-background/65">
        <div className="px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {mode === "staff" ? "Team lanes" : "Resource lanes"}
          </p>
        </div>
        <div className="grid grid-cols-11">
          {Array.from({ length: 11 }, (_, index) => (
            <div
              key={index}
              className="border-l border-border/70 px-2 py-3 font-mono text-[10px] text-muted-foreground"
            >
              {String(OPENING_HOUR + index).padStart(2, "0")}:00
            </div>
          ))}
        </div>
      </div>
      {items.length ? (
        items.map(item => {
          const lane = laneAppointments(item.id);
          const conflicts = lane.filter(appointment =>
            isConflict(appointment, lane)
          ).length;
          return (
            <div
              key={item.id}
              className="grid grid-cols-[200px_1fr] border-b border-border/70 last:border-b-0"
            >
              <div className="flex min-h-[104px] flex-col justify-center border-r border-border/70 px-5">
                <p className="text-xs font-semibold">{item.name}</p>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-[10px] font-medium",
                    conflicts ? "text-destructive" : "text-primary"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      conflicts ? "bg-destructive" : "bg-primary"
                    )}
                  />
                  {conflicts
                    ? `${conflicts} overlap${conflicts === 1 ? "" : "s"} to resolve`
                    : "Conflict safe"}
                </p>
              </div>
              <div className="relative min-h-[104px] bg-card/20">
                {Array.from({ length: 11 }, (_, index) => (
                  <div
                    key={index}
                    className="absolute inset-y-0 border-l border-dashed border-border/70"
                    style={{ left: `${(index / 11) * 100}%` }}
                  />
                ))}
                {lane.map(appointment => {
                  const left = Math.max(
                    0,
                    ((appointment.startsAt -
                      (dayStart + OPENING_HOUR * 3_600_000)) /
                      3_600_000 /
                      11) *
                      100
                  );
                  const width = Math.min(
                    100 - left,
                    ((appointment.endsAt - appointment.startsAt) /
                      3_600_000 /
                      11) *
                      100
                  );
                  return (
                    <div
                      key={appointment.id}
                      className={cn(
                        "absolute top-4 overflow-hidden rounded-xl border-l-[3px] bg-card px-3 py-2 shadow-[0_6px_14px_oklch(0.25_0.018_75_/_9%)]",
                        isConflict(appointment, lane) &&
                          "ring-2 ring-destructive/55"
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 10)}%`,
                        minWidth: "108px",
                        borderLeftColor: appointment.serviceColor,
                      }}
                    >
                      <p className="truncate text-[11px] font-bold">
                        {appointment.customerName}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {format(new Date(appointment.startsAt), "HH:mm")} ·{" "}
                        {appointment.serviceName}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-10 text-center">
          <p className="font-display text-xl">Nothing is assigned here yet.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Choose another team member or resource to inspect its capacity.
          </p>
        </div>
      )}
    </div>
  );
}

function WeekLaneCalendar({
  items,
  appointments,
  mode,
  days,
}: {
  items: Array<{ id: number; name: string; color?: string }>;
  appointments: Array<{
    id: number;
    staffId: number;
    resourceId: number | null;
    startsAt: number;
    endsAt: number;
    customerName: string;
    serviceName: string;
    serviceColor: string;
  }>;
  mode: CalendarMode;
  days: Date[];
}) {
  const isConflict = (
    appointment: { id: number; startsAt: number; endsAt: number },
    inLane: Array<{ id: number; startsAt: number; endsAt: number }>
  ) =>
    inLane.some(
      other =>
        other.id !== appointment.id &&
        appointment.startsAt < other.endsAt &&
        appointment.endsAt > other.startsAt
    );
  return (
    <div className="min-w-[940px] bg-background/30">
      <div
        className="grid border-b border-border/80 bg-background/65"
        style={{
          gridTemplateColumns: `200px repeat(${days.length}, minmax(140px, 1fr))`,
        }}
      >
        <div className="px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {mode === "staff" ? "Team lanes" : "Resource lanes"}
          </p>
        </div>
        {days.map(day => (
          <div
            key={day.toISOString()}
            className="border-l border-border/70 px-4 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {format(day, "EEE")}
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {format(day, "d MMM")}
            </p>
          </div>
        ))}
      </div>
      {items.length ? (
        items.map(item => (
          <div
            key={item.id}
            className="grid border-b border-border/70 last:border-b-0"
            style={{
              gridTemplateColumns: `200px repeat(${days.length}, minmax(140px, 1fr))`,
            }}
          >
            <div className="flex min-h-[104px] flex-col justify-center border-r border-border/70 px-5">
              <p className="text-xs font-semibold">{item.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Capacity monitored
              </p>
            </div>
            {days.map(day => {
              const start = dayStartUtc(day);
              const inCell = appointments.filter(
                appointment =>
                  appointment.startsAt >= start &&
                  appointment.startsAt < start + 86_400_000 &&
                  (mode === "staff"
                    ? appointment.staffId === item.id
                    : appointment.resourceId === item.id)
              );
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[104px] border-l border-border/70 bg-card/20 p-2"
                >
                  {inCell.map(appointment => (
                    <div
                      key={appointment.id}
                      className={cn(
                        "mb-1.5 rounded-lg border-l-[3px] bg-card px-2.5 py-2 shadow-sm",
                        isConflict(appointment, inCell) &&
                          "ring-2 ring-destructive/55"
                      )}
                      style={{ borderLeftColor: appointment.serviceColor }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[10px] font-bold">
                          {appointment.customerName}
                        </p>
                        {isConflict(appointment, inCell) && (
                          <span className="font-mono text-[9px] uppercase text-destructive">
                            Overlap
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {format(new Date(appointment.startsAt), "HH:mm")} ·{" "}
                        {appointment.serviceName}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <div className="p-10 text-center">
          <p className="font-display text-xl">Nothing is assigned here yet.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Choose another team member or resource to inspect its capacity.
          </p>
        </div>
      )}
    </div>
  );
}

function AppointmentBlock({
  appointment,
  mode,
  calendarStart,
  dayCount,
}: {
  appointment: {
    id: number;
    startsAt: number;
    endsAt: number;
    customerName: string;
    serviceName: string;
    staffName: string;
    resourceName: string | null;
    status: string;
    serviceColor: string;
  };
  mode: CalendarMode;
  calendarStart: number;
  dayCount: number;
}) {
  const start = new Date(appointment.startsAt);
  const top =
    (((start.getUTCHours() - OPENING_HOUR) * 60 + start.getUTCMinutes()) / 60) *
    HOUR_HEIGHT;
  const height = Math.max(
    ((appointment.endsAt - appointment.startsAt) / 3_600_000) * HOUR_HEIGHT - 6,
    44
  );
  const dayIndex = Math.floor(
    (dayStartUtc(start) - calendarStart) / 86_400_000
  );
  if (dayIndex < 0 || dayIndex >= dayCount) return null;
  return (
    <article
      className="absolute z-10 mx-1 overflow-hidden rounded-xl border-l-[3px] bg-card px-2.5 py-2 shadow-[0_7px_16px_oklch(0.25_0.018_75_/_9%)]"
      style={{
        left: `calc(76px + ${dayIndex} * ((100% - 76px) / ${dayCount}) + 4px)`,
        width: `calc((100% - 76px) / ${dayCount} - 8px)`,
        top,
        height,
        borderLeftColor: appointment.serviceColor,
      }}
    >
      <p className="truncate text-[11px] font-bold leading-4">
        {appointment.customerName}
      </p>
      <p className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground">
        {format(start, "HH:mm")} · {appointment.serviceName}
      </p>
      <p
        className="mt-1 truncate text-[10px] font-medium"
        style={{ color: appointment.serviceColor }}
      >
        {mode === "staff"
          ? appointment.staffName
          : appointment.resourceName || "Unassigned"}
      </p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <div className="space-y-3 pl-8">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-11 w-[min(640px,80vw)]" />
        <Skeleton className="h-4 w-[min(440px,70vw)]" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-[1.25rem]" />
        ))}
      </div>
      <Skeleton className="h-[680px] rounded-[1.4rem]" />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="surface-card mx-auto max-w-lg rounded-[1.4rem] p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Schedule unavailable
      </p>
      <h1 className="font-display mt-2 text-3xl">
        We couldn’t open the calendar.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The workspace data is taking longer than expected. Your booking records
        have not been changed.
      </p>
      <Button
        onClick={onRetry}
        className="pressable mt-6 rounded-xl bg-primary text-primary-foreground"
      >
        Try again
      </Button>
    </section>
  );
}
