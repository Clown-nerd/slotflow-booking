import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { addDays, format, startOfDay } from "date-fns";
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

type BookingStage = "selection" | "details" | "payment" | "success" | "failed";
const dayStartUtc = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const money = (cents: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(cents / 100);
const bookingTime = (timestamp: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-KE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
const bookingDateTime = (timestamp: number, timeZone: string, short = false) =>
  new Intl.DateTimeFormat("en-KE", {
    timeZone,
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));

export default function Booking() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug || "slotflow-studio";
  const setup = trpc.booking.publicSetup.useQuery({ slug });
  const [stage, setStage] = useState<BookingStage>("selection");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    addDays(startOfDay(new Date()), 1)
  );
  const [slot, setSlot] = useState<number | null>(null);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [payment, setPayment] = useState<{
    providerReference: string;
    bookingReference: string;
    depositCents: number;
  } | null>(null);

  useEffect(() => {
    if (!setup.data) return;
    if (!serviceId) setServiceId(setup.data.services[0]?.id ?? null);
    if (!resourceId) setResourceId(setup.data.resources[0]?.id ?? null);
  }, [setup.data, serviceId, resourceId]);

  const selectableStaff = useMemo(() => {
    if (!setup.data || !serviceId) return [];
    return setup.data.staff.filter(staff =>
      setup.data!.staffServiceAssignments.some(
        assignment =>
          assignment.staffId === staff.id && assignment.serviceId === serviceId
      )
    );
  }, [setup.data, serviceId]);

  useEffect(() => {
    if (
      selectableStaff.length &&
      !selectableStaff.some(staff => staff.id === staffId)
    )
      setStaffId(selectableStaff[0]!.id);
  }, [selectableStaff, staffId]);

  const selectedService = setup.data?.services.find(
    service => service.id === serviceId
  );
  const selectedStaff = setup.data?.staff.find(staff => staff.id === staffId);
  const bookingDate = format(selectedDate, "yyyy-MM-dd");
  const slotInput = useMemo(
    () => ({
      slug,
      serviceId: serviceId ?? 1,
      staffId: staffId ?? 1,
      resourceId,
      date: bookingDate,
    }),
    [slug, serviceId, staffId, resourceId, bookingDate]
  );
  const slots = trpc.booking.availableSlots.useQuery(slotInput, {
    enabled: Boolean(serviceId && staffId && stage === "selection"),
  });
  const create = trpc.booking.createPublicAppointment.useMutation({
    onSuccess: data => {
      setPayment(data);
      setStage("payment");
      setFormError("");
    },
    onError: error => {
      setFormError(error.message);
      setStage("details");
    },
  });
  const retryPayment = trpc.booking.retrySimulatedPayment.useMutation({
    onSuccess: data => {
      setPayment(data);
      setStage("payment");
      setFormError("");
    },
    onError: error => setFormError(error.message),
  });

  if (setup.isLoading) return <BookingSkeleton />;
  if (setup.error || !setup.data) return <BookingUnavailable />;

  const chooseSelection = () => {
    if (!serviceId || !staffId || !slot) {
      setFormError(
        "Choose a service, specialist, and available time before continuing."
      );
      return;
    }
    setFormError("");
    setStage("details");
  };
  const submitDetails = (event: FormEvent) => {
    event.preventDefault();
    if (!serviceId || !staffId || !slot) {
      setStage("selection");
      return;
    }
    if (customer.name.trim().length < 2 || customer.phone.trim().length < 8) {
      setFormError(
        "Enter your full name and a valid mobile number so we can hold your booking."
      );
      return;
    }
    if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) {
      setFormError(
        "Enter a valid email address or leave it blank to receive SMS reminders only."
      );
      return;
    }
    create.mutate({
      slug,
      serviceId,
      staffId,
      resourceId,
      startsAt: slot,
      bookingDate,
      customerName: customer.name,
      customerEmail: customer.email || null,
      customerPhone: customer.phone,
      notes: customer.notes || null,
    });
  };

  return (
    <main className="min-h-screen bg-[#F4F1EB] text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-5 sm:px-7 sm:pt-8">
        <header className="flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span>
                <span className="font-display block text-xl leading-5">
                  SlotFlow
                </span>
                <span className="font-mono block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Booking suite
                </span>
              </span>
            </span>
          </Link>
          <Link href="/">
            <span className="hidden text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Business dashboard
            </span>
          </Link>
        </header>
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1fr_370px] lg:gap-10">
          <section className="surface-card overflow-hidden rounded-[1.6rem]">
            <div className="border-b border-border/80 bg-card/70 px-5 py-5 sm:px-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {setup.data.business.name}
              </p>
              <h1 className="font-display mt-2 text-4xl tracking-[-0.045em] sm:text-5xl">
                Reserve your time.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                A considered booking experience, with a time held for your
                deposit and reminders handled in good time.
              </p>
            </div>
            <Progress stage={stage} />
            {stage === "selection" && (
              <SelectionStep
                services={setup.data.services}
                staff={selectableStaff}
                resources={setup.data.resources}
                timeZone={setup.data.business.timezone}
                serviceId={serviceId}
                staffId={staffId}
                resourceId={resourceId}
                setServiceId={id => {
                  setServiceId(id);
                  setSlot(null);
                }}
                setStaffId={id => {
                  setStaffId(id);
                  setSlot(null);
                }}
                setResourceId={id => {
                  setResourceId(id);
                  setSlot(null);
                }}
                selectedDate={selectedDate}
                setSelectedDate={date => {
                  setSelectedDate(date);
                  setSlot(null);
                }}
                slots={slots.data ?? []}
                slotsLoading={slots.isLoading}
                selectedSlot={slot}
                setSelectedSlot={setSlot}
                onContinue={chooseSelection}
                error={formError}
              />
            )}
            {stage === "details" && (
              <DetailsStep
                service={selectedService}
                staff={selectedStaff}
                slot={slot}
                timeZone={setup.data.business.timezone}
                customer={customer}
                setCustomer={setCustomer}
                onBack={() => {
                  setStage("selection");
                  setFormError("");
                }}
                onSubmit={submitDetails}
                error={formError}
                pending={create.isPending}
              />
            )}
            {stage === "payment" && payment && (
              <PaymentStep
                payment={payment}
                phone={customer.phone}
                onSuccess={() => setStage("success")}
                onFailure={() => setStage("failed")}
              />
            )}
            {stage === "success" && payment && (
              <SuccessStep
                bookingReference={payment.bookingReference}
                service={selectedService?.name || "Your appointment"}
                staff={selectedStaff?.name || "Your specialist"}
                slot={slot}
                timeZone={setup.data.business.timezone}
                email={customer.email}
              />
            )}
            {stage === "failed" && payment && (
              <PaymentFailed
                payment={payment}
                onRetry={() =>
                  retryPayment.mutate({
                    providerReference: payment.providerReference,
                  })
                }
                onBack={() => setStage("details")}
                pending={retryPayment.isPending}
                error={formError}
              />
            )}
          </section>
          <BookingAside
            service={selectedService}
            staff={selectedStaff}
            selectedSlot={slot}
            timeZone={setup.data.business.timezone}
            stage={stage}
          />
        </div>
      </div>
    </main>
  );
}

function Progress({ stage }: { stage: BookingStage }) {
  const states = ["selection", "details", "payment"] as const;
  const current =
    stage === "success" || stage === "failed"
      ? 3
      : states.indexOf(stage as (typeof states)[number]) + 1;
  return (
    <div className="flex border-b border-border/80 px-5 sm:px-7">
      {["Choose time", "Your details", "Deposit"].map((label, index) => (
        <div key={label} className="relative flex-1 py-4">
          <p
            className={cn(
              "text-[11px] font-semibold",
              current >= index + 1 ? "text-primary" : "text-muted-foreground"
            )}
          >
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="ml-1 hidden sm:inline">{label}</span>
          </p>
          {current === index + 1 && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </div>
      ))}
    </div>
  );
}

function SelectionStep({
  services,
  staff,
  resources,
  timeZone,
  serviceId,
  staffId,
  resourceId,
  setServiceId,
  setStaffId,
  setResourceId,
  selectedDate,
  setSelectedDate,
  slots,
  slotsLoading,
  selectedSlot,
  setSelectedSlot,
  onContinue,
  error,
}: {
  services: Array<{
    id: number;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    depositCents: number;
    color: string;
  }>;
  staff: Array<{
    id: number;
    name: string;
    roleTitle: string | null;
    color: string;
  }>;
  resources: Array<{ id: number; name: string; resourceType: string }>;
  timeZone: string;
  serviceId: number | null;
  staffId: number | null;
  resourceId: number | null;
  setServiceId: (id: number) => void;
  setStaffId: (id: number) => void;
  setResourceId: (id: number) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  slots: number[];
  slotsLoading: boolean;
  selectedSlot: number | null;
  setSelectedSlot: (slot: number) => void;
  onContinue: () => void;
  error: string;
}) {
  const dates = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfDay(new Date()), index + 1)
  );
  return (
    <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-8">
      <div>
        <StepTitle
          number="01"
          title="Choose your ritual"
          detail="Every service has its own duration and deposit."
        />
        <div className="mt-4 grid gap-2.5">
          {services.map(service => (
            <button
              key={service.id}
              onClick={() => setServiceId(service.id)}
              className={cn(
                "group flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all",
                serviceId === service.id
                  ? "border-primary bg-[#E9EDDF] shadow-[0_8px_18px_oklch(0.33_0.047_142_/_9%)]"
                  : "border-border bg-background/60 hover:border-primary/35 hover:bg-secondary/35"
              )}
            >
              <div className="flex gap-3">
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: service.color }}
                />
                <div>
                  <p className="text-sm font-semibold">{service.name}</p>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold">
                  {money(service.priceCents)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {service.durationMinutes} min
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <StepTitle
            number="02"
            title="Choose a specialist"
            detail="Only specialists who offer your chosen service are shown."
          />
          <div className="mt-4 space-y-2">
            {staff.length ? (
              staff.map(member => (
                <button
                  key={member.id}
                  onClick={() => setStaffId(member.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    staffId === member.id
                      ? "border-primary bg-[#E9EDDF]"
                      : "border-border bg-background/60 hover:border-primary/35"
                  )}
                >
                  <span
                    className="grid size-8 place-items-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: `${member.color}20`,
                      color: member.color,
                    }}
                  >
                    {member.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">
                      {member.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {member.roleTitle || "Specialist"}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "ml-auto size-4",
                      staffId === member.id
                        ? "text-primary"
                        : "text-transparent"
                    )}
                  />
                </button>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                No specialist currently offers this service. Please select a
                different service.
              </p>
            )}
          </div>
        </div>
        <div>
          <StepTitle
            number="03"
            title="Choose a space"
            detail="A protected resource prevents capacity conflicts."
          />
          <div className="mt-4 space-y-2">
            {resources.map(resource => (
              <button
                key={resource.id}
                onClick={() => setResourceId(resource.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                  resourceId === resource.id
                    ? "border-primary bg-[#E9EDDF]"
                    : "border-border bg-background/60 hover:border-primary/35"
                )}
              >
                <span>
                  <span className="block text-xs font-semibold">
                    {resource.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {resource.resourceType}
                  </span>
                </span>
                <Check
                  className={cn(
                    "size-4",
                    resourceId === resource.id
                      ? "text-primary"
                      : "text-transparent"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <StepTitle
          number="04"
          title="Choose an available time"
          detail={`Slots are shown in ${timeZone.replace("_", " ")} and update against the service length, specialist, resource, and existing bookings.`}
        />
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {dates.map(date => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "min-w-16 rounded-xl border px-3 py-3 text-center transition-colors",
                dayStartUtc(date) === dayStartUtc(selectedDate)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/35"
              )}
            >
              <span className="block font-mono text-[9px] uppercase tracking-[0.08em]">
                {format(date, "EEE")}
              </span>
              <span className="mt-1 block text-sm font-semibold">
                {format(date, "d")}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slotsLoading ? (
            Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11 rounded-xl" />
            ))
          ) : slots.length ? (
            slots.map(value => (
              <button
                key={value}
                onClick={() => setSelectedSlot(value)}
                className={cn(
                  "rounded-xl border py-3 text-xs font-semibold transition-colors",
                  selectedSlot === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/35 hover:bg-secondary/30"
                )}
              >
                {bookingTime(value, timeZone)}
              </button>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-muted-foreground">
              No suitable times remain for this combination. Try another
              specialist, resource, or date.
            </div>
          )}
        </div>
      </div>
      {error && <InlineError text={error} />}
      <div className="flex justify-end border-t border-border/70 pt-5">
        <Button
          onClick={onContinue}
          className="pressable h-11 rounded-xl bg-primary px-5 text-primary-foreground"
        >
          Continue to details <ChevronRight className="ml-1.5 size-4" />
        </Button>
      </div>
    </div>
  );
}

function DetailsStep({
  service,
  staff,
  slot,
  timeZone,
  customer,
  setCustomer,
  onBack,
  onSubmit,
  error,
  pending,
}: {
  service:
    | { name: string; durationMinutes: number; depositCents: number }
    | undefined;
  staff: { name: string } | undefined;
  slot: number | null;
  timeZone: string;
  customer: { name: string; email: string; phone: string; notes: string };
  setCustomer: (customer: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  }) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent) => void;
  error: string;
  pending: boolean;
}) {
  return (
    <div className="px-5 py-6 sm:px-7 sm:py-8">
      <StepTitle
        number="02"
        title="Your details"
        detail="We’ll use these only for your appointment and reminders."
      />
      <div className="mt-5 rounded-2xl bg-secondary/55 p-4">
        <p className="text-xs font-semibold">
          {service?.name} with {staff?.name}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {slot ? bookingDateTime(slot, timeZone) : "Choose a time"} ·{" "}
          {service?.durationMinutes || 0} minutes
        </p>
      </div>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <BookingField label="Full name" icon={UserRound}>
          <Input
            required
            value={customer.name}
            onChange={event =>
              setCustomer({ ...customer, name: event.target.value })
            }
            placeholder="Your full name"
            className="h-11 rounded-xl bg-background"
          />
        </BookingField>
        <div className="grid gap-4 sm:grid-cols-2">
          <BookingField label="Mobile number" icon={Phone}>
            <Input
              required
              inputMode="tel"
              value={customer.phone}
              onChange={event =>
                setCustomer({ ...customer, phone: event.target.value })
              }
              placeholder="0712 345 678"
              className="h-11 rounded-xl bg-background"
            />
          </BookingField>
          <BookingField label="Email (optional)" icon={Mail}>
            <Input
              inputMode="email"
              value={customer.email}
              onChange={event =>
                setCustomer({ ...customer, email: event.target.value })
              }
              placeholder="you@example.com"
              className="h-11 rounded-xl bg-background"
            />
          </BookingField>
        </div>
        <BookingField label="A note for your specialist (optional)">
          <Textarea
            value={customer.notes}
            onChange={event =>
              setCustomer({ ...customer, notes: event.target.value })
            }
            placeholder="Anything helpful to know before your visit?"
            className="min-h-24 rounded-xl bg-background"
          />
        </BookingField>
        {error && <InlineError text={error} />}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <Button
            disabled={pending}
            type="submit"
            className="pressable h-11 rounded-xl bg-primary px-5 text-primary-foreground"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Holding your time…
              </>
            ) : (
              <>
                Continue to deposit <ChevronRight className="ml-1.5 size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaymentStep({
  payment,
  phone,
  onSuccess,
  onFailure,
}: {
  payment: {
    providerReference: string;
    bookingReference: string;
    depositCents: number;
  };
  phone: string;
  onSuccess: () => void;
  onFailure: () => void;
}) {
  const complete = trpc.booking.completeSimulatedPayment.useMutation({
    onSuccess: data =>
      data.paymentStatus === "paid" ? onSuccess() : onFailure(),
    onError: onFailure,
  });
  return (
    <div className="px-5 py-6 sm:px-7 sm:py-8">
      <StepTitle
        number="03"
        title="Secure your appointment"
        detail="This is a realistic payment simulation. No money will move."
      />
      <div className="mt-6 rounded-[1.25rem] bg-[#173329] p-5 text-[#F7F5ED]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#B9CAB4]">
              M-Pesa express simulation
            </p>
            <p className="mt-3 font-display text-3xl">
              {money(payment.depositCents)}
            </p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-white/10">
            <CreditCard className="size-4" />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-4 text-xs">
          <span className="text-[#C5D2C1]">
            Prompt sent to {phone || "your phone"}
          </span>
          <span className="font-mono text-[10px]">
            {payment.providerReference}
          </span>
        </div>
      </div>
      <p className="mt-4 flex gap-2 rounded-xl border border-[#DCE4CE] bg-[#EFF2E8] p-3 text-[11px] leading-5 text-[#4E5D39]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        For this demo, choose an outcome below as if you had confirmed or
        cancelled the prompt on your phone.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate({
              providerReference: payment.providerReference,
              outcome: "paid",
            })
          }
          className="pressable h-11 rounded-xl bg-primary text-primary-foreground"
        >
          {complete.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <LockKeyhole className="mr-2 size-4" />
              Confirm deposit
            </>
          )}
        </Button>
        <Button
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate({
              providerReference: payment.providerReference,
              outcome: "failed",
            })
          }
          variant="outline"
          className="pressable h-11 rounded-xl border-border bg-card text-xs"
        >
          Simulate a failed payment
        </Button>
      </div>
      <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Booking reference · {payment.bookingReference}
      </p>
    </div>
  );
}

function SuccessStep({
  bookingReference,
  service,
  staff,
  slot,
  timeZone,
  email,
}: {
  bookingReference: string;
  service: string;
  staff: string;
  slot: number | null;
  timeZone: string;
  email: string;
}) {
  return (
    <div className="px-5 py-12 text-center sm:px-7">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#E3E8D7] text-[#40502F]">
        <CalendarCheck2 className="size-6" />
      </div>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Deposit received
      </p>
      <h2 className="font-display mt-2 text-4xl tracking-[-0.04em]">
        Your time is held.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Your appointment is awaiting studio confirmation. We’ve saved a clear
        record and queued your reminder plan.
      </p>
      <div className="mx-auto mt-7 max-w-md rounded-2xl border border-border bg-background/70 p-5 text-left">
        <p className="text-sm font-semibold">{service}</p>
        <p className="mt-1 text-xs text-muted-foreground">with {staff}</p>
        <p className="mt-4 flex items-center gap-2 text-xs">
          <Clock3 className="size-3.5 text-primary" />
          {slot ? bookingDateTime(slot, timeZone) : "Time selected"}
        </p>
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Reference
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {bookingReference}
          </p>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-md text-[11px] leading-5 text-muted-foreground">
        An SMS reminder is scheduled for 24 hours before your visit
        {email ? ", with an email reminder queued too" : ""}.
      </p>
      <Link href="/">
        <span className="mt-7 inline-flex text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4">
          Return to SlotFlow
        </span>
      </Link>
    </div>
  );
}

function PaymentFailed({
  payment,
  onRetry,
  onBack,
  pending,
  error,
}: {
  payment: { bookingReference: string; depositCents: number };
  onRetry: () => void;
  onBack: () => void;
  pending: boolean;
  error: string;
}) {
  return (
    <div className="px-5 py-10 text-center sm:px-7">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#F5E4E2] text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Deposit incomplete
      </p>
      <h2 className="font-display mt-2 text-4xl tracking-[-0.04em]">
        Your time is still held.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        The simulated M-Pesa prompt was not completed. You can retry the{" "}
        {money(payment.depositCents)} deposit or return to your details.
      </p>
      {error && (
        <div className="mx-auto mt-5 max-w-md text-left">
          <InlineError text={error} />
        </div>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button
          disabled={pending}
          onClick={onRetry}
          className="pressable rounded-xl bg-primary text-primary-foreground"
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Refreshing prompt…
            </>
          ) : (
            "Try deposit again"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          className="pressable rounded-xl border-border bg-card"
        >
          Back to details
        </Button>
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Reference · {payment.bookingReference}
      </p>
    </div>
  );
}

function BookingAside({
  service,
  staff,
  selectedSlot,
  timeZone,
  stage,
}: {
  service:
    | {
        name: string;
        durationMinutes: number;
        priceCents: number;
        depositCents: number;
      }
    | undefined;
  staff: { name: string } | undefined;
  selectedSlot: number | null;
  timeZone: string;
  stage: BookingStage;
}) {
  return (
    <aside className="lg:sticky lg:top-8">
      <div className="surface-card rounded-[1.6rem] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Your appointment
        </p>
        {service ? (
          <>
            <h2 className="font-display mt-2 text-2xl tracking-tight">
              {service.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {service.durationMinutes} minutes{" "}
              {staff ? `with ${staff.name}` : ""}
            </p>
            <div className="mt-5 space-y-3 border-y border-border/70 py-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Service</span>
                <span className="font-semibold">
                  {money(service.priceCents)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Deposit today</span>
                <span className="font-semibold text-primary">
                  {money(service.depositCents)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Select a service to see the appointment summary.
          </p>
        )}
        {selectedSlot && (
          <p className="mt-4 flex gap-2 text-[11px] leading-5 text-muted-foreground">
            <CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-primary" />
            {bookingDateTime(selectedSlot, timeZone, true)}
          </p>
        )}
        <div className="mt-5 rounded-xl bg-secondary/60 p-3">
          <p className="flex gap-2 text-[11px] leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {stage === "payment"
              ? "You are viewing a safe payment simulation. No funds leave your account."
              : "Your selected time is verified against the live schedule before the deposit step."}
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
        Need help with your booking? Contact the studio directly.
      </p>
    </aside>
  );
}
function StepTitle({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
        {number}
      </p>
      <h2 className="font-display mt-1 text-2xl tracking-tight">{title}</h2>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
function BookingField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Phone;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </Label>
      {children}
    </div>
  );
}
function InlineError({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-xl border border-[#E9CBC6] bg-[#FBEFEE] p-3 text-xs leading-5 text-[#914941]"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  );
}
function BookingSkeleton() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto max-w-[1200px]">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_370px]">
          <Skeleton className="h-[720px] rounded-[1.6rem]" />
          <Skeleton className="h-72 rounded-[1.6rem]" />
        </div>
      </div>
    </main>
  );
}
function BookingUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="surface-card max-w-md rounded-[1.6rem] p-8 text-center">
        <CircleAlert className="mx-auto size-6 text-destructive" />
        <h1 className="font-display mt-4 text-3xl">
          This booking page is unavailable.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The studio’s booking link may have changed. Please return to the
          dashboard or contact the business.
        </p>
        <Link href="/">
          <span className="mt-6 inline-flex text-xs font-semibold text-primary">
            Return to SlotFlow
          </span>
        </Link>
      </section>
    </main>
  );
}
