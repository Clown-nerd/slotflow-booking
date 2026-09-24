import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock3,
  Pencil,
  Plus,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const rangeForDashboard = () => {
  const today = new Date();
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return { start, end: start + 8 * 86_400_000 };
};
const minutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const timeFromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export default function Manage() {
  return (
    <DashboardLayout>
      <ManagementWorkspace />
    </DashboardLayout>
  );
}

function ManagementWorkspace() {
  const [range] = useState(rangeForDashboard);
  const utils = trpc.useUtils();
  const workspace = trpc.booking.setupDemoWorkspace.useMutation({
    onSuccess: () => utils.booking.dashboard.invalidate(),
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    if (!workspace.isPending && !workspace.data && !workspace.error)
      workspace.mutate();
  }, [workspace]);
  const dashboard = trpc.booking.dashboard.useQuery(range, {
    enabled: Boolean(workspace.data),
  });
  const refresh = () => utils.booking.dashboard.invalidate();

  if (workspace.isPending || dashboard.isLoading) return <ManageSkeleton />;
  if (workspace.error || dashboard.error || !dashboard.data)
    return (
      <section className="surface-card mx-auto max-w-lg rounded-[1.4rem] p-8 text-center">
        <Sparkles className="mx-auto size-5 text-primary" />
        <h1 className="font-display mt-3 text-3xl">
          Your workspace is taking a moment.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Please refresh the page. No booking data has been changed.
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="pressable mt-6 rounded-xl bg-primary text-primary-foreground"
        >
          Refresh workspace
        </Button>
      </section>
    );

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-8 border-b border-border/80 pb-6 pl-8 lg:pl-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Business setup
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-[-0.04em]">
          Shape what customers can book.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Changes here update the schedule foundation for your private
          workspace. Paused records remain in your history while staying out of
          future bookings.
        </p>
      </header>
      <section className="grid gap-6 lg:grid-cols-2">
        <ServiceManager services={dashboard.data.services} onSaved={refresh} />
        <StaffManager
          services={dashboard.data.services}
          staff={dashboard.data.staff}
          onSaved={refresh}
        />
        <ResourceManager
          resources={dashboard.data.resources}
          onSaved={refresh}
        />
        <AvailabilityManager
          availability={dashboard.data.availability}
          onSaved={refresh}
        />
        <TargetAvailabilityManager
          staff={dashboard.data.staff}
          resources={dashboard.data.resources}
          onSaved={refresh}
        />
        <DetailedEditManager
          services={dashboard.data.services}
          staff={dashboard.data.staff}
          resources={dashboard.data.resources}
          assignments={dashboard.data.staffServiceAssignments}
          onSaved={refresh}
        />
        <LifecycleAndReminderManager
          appointments={dashboard.data.appointments}
          reminders={dashboard.data.reminders}
          reminderSettings={dashboard.data.reminderSettings}
          scheduleActive={Boolean(dashboard.data.business.scheduleCronTaskUid)}
          onSaved={refresh}
        />
      </section>
    </div>
  );
}

function Panel({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: typeof Plus;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card rounded-[1.4rem] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="font-display mt-0.5 text-2xl tracking-tight">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RecordActions({
  name,
  active,
  pending,
  onToggle,
  onRename,
}: {
  name: string;
  active: boolean;
  pending: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Badge
        className={
          active
            ? "border-[#C9D4B3] bg-[#E3E8D7] text-[10px] text-[#40502F]"
            : "border-[#DEDAD3] bg-[#EEECE7] text-[10px] text-[#665F56]"
        }
      >
        {active ? "Active" : "Paused"}
      </Badge>
      <Dialog>
        <DialogTrigger asChild>
          <button
            aria-label={`Rename ${name}`}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Rename record
            </DialogTitle>
            <DialogDescription>
              Choose a clear name customers and your team will recognize.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const value = new FormData(event.currentTarget)
                .get("name")
                ?.toString()
                .trim();
              if (value && value.length >= 2) onRename(value);
            }}
            className="grid gap-4"
          >
            <Field label="Name">
              <Input
                name="name"
                defaultValue={name}
                required
                minLength={2}
                className="h-10 rounded-xl"
              />
            </Field>
            <Button
              type="submit"
              className="pressable rounded-xl bg-primary text-primary-foreground"
            >
              Save name
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <button
        disabled={pending}
        onClick={onToggle}
        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {active ? "Pause" : "Resume"}
      </button>
    </div>
  );
}

function ServiceManager({
  services,
  onSaved,
}: {
  services: Array<{
    id: number;
    name: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number;
    color: string;
    active: boolean;
  }>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const create = trpc.booking.createService.useMutation({
    onSuccess: () => {
      toast.success("Service added to your menu.");
      setName("");
      setPrice("");
      setDeposit("");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const active = trpc.booking.setServiceActive.useMutation({
    onSuccess: () => {
      toast.success("Service visibility updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const rename = trpc.booking.renameService.useMutation({
    onSuccess: () => {
      toast.success("Service renamed.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      name,
      durationMinutes: Number(duration),
      priceCents: Math.round(Number(price) * 100),
      depositCents: Math.round(Number(deposit || 0) * 100),
      color: "#71805B",
    });
  };
  return (
    <Panel icon={Plus} eyebrow="Service menu" title="Treatments & deposits">
      <div className="mt-5 space-y-2.5">
        {services.map(service => (
          <div
            key={service.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{service.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {service.durationMinutes} min · KES{" "}
                {(service.priceCents / 100).toLocaleString()} · Deposit KES{" "}
                {(service.depositCents / 100).toLocaleString()}
              </p>
            </div>
            <RecordActions
              name={service.name}
              active={service.active}
              pending={active.isPending || rename.isPending}
              onToggle={() =>
                active.mutate({
                  serviceId: service.id,
                  active: !service.active,
                })
              }
              onRename={value =>
                rename.mutate({ serviceId: service.id, name: value })
              }
            />
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2"
      >
        <Field label="Service name">
          <Input
            required
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Consultation"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="Duration">
          <select
            value={duration}
            onChange={event => setDuration(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
            <option value="120">120 minutes</option>
          </select>
        </Field>
        <Field label="Price (KES)">
          <Input
            required
            inputMode="numeric"
            type="number"
            min="0"
            value={price}
            onChange={event => setPrice(event.target.value)}
            placeholder="0"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="Deposit (KES)">
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            value={deposit}
            onChange={event => setDeposit(event.target.value)}
            placeholder="0"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Button
          disabled={create.isPending}
          className="pressable h-10 rounded-xl bg-primary text-primary-foreground sm:col-span-2"
        >
          {create.isPending ? "Saving service…" : "Add service"}
        </Button>
      </form>
    </Panel>
  );
}

function StaffManager({
  services,
  staff,
  onSaved,
}: {
  services: Array<{ id: number; name: string }>;
  staff: Array<{
    id: number;
    name: string;
    roleTitle: string | null;
    color: string;
    active: boolean;
  }>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const create = trpc.booking.createStaffMember.useMutation({
    onSuccess: () => {
      toast.success("Team member added.");
      setName("");
      setRoleTitle("");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const active = trpc.booking.setStaffActive.useMutation({
    onSuccess: () => {
      toast.success("Team availability updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const rename = trpc.booking.renameStaffMember.useMutation({
    onSuccess: () => {
      toast.success("Team member renamed.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      name,
      roleTitle,
      color: "#667A87",
      serviceIds: serviceId ? [Number(serviceId)] : [],
    });
  };
  return (
    <Panel icon={UsersRound} eyebrow="People" title="Your team">
      <div className="mt-5 space-y-2.5">
        {staff.map(member => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: member.color }}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{member.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {member.roleTitle || "Specialist"}
                </p>
              </div>
            </div>
            <RecordActions
              name={member.name}
              active={member.active}
              pending={active.isPending || rename.isPending}
              onToggle={() =>
                active.mutate({ staffId: member.id, active: !member.active })
              }
              onRename={value =>
                rename.mutate({ staffId: member.id, name: value })
              }
            />
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2"
      >
        <Field label="Team member">
          <Input
            required
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Full name"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="Role">
          <Input
            value={roleTitle}
            onChange={event => setRoleTitle(event.target.value)}
            placeholder="e.g. Therapist"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="Primary service">
          <select
            value={serviceId}
            onChange={event => setServiceId(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Assign later</option>
            {services
              .filter(service => ("active" in service ? service.active : true))
              .map(service => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="flex items-end">
          <Button
            disabled={create.isPending}
            className="pressable h-10 w-full rounded-xl bg-primary text-primary-foreground"
          >
            {create.isPending ? "Saving…" : "Add team member"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ResourceManager({
  resources,
  onSaved,
}: {
  resources: Array<{
    id: number;
    name: string;
    resourceType: string;
    capacity: number;
    active: boolean;
  }>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [resourceType, setType] = useState("");
  const create = trpc.booking.createResource.useMutation({
    onSuccess: () => {
      toast.success("Resource added to capacity planning.");
      setName("");
      setType("");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const active = trpc.booking.setResourceActive.useMutation({
    onSuccess: () => {
      toast.success("Resource availability updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const rename = trpc.booking.renameResource.useMutation({
    onSuccess: () => {
      toast.success("Resource renamed.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name, resourceType, capacity: 1 });
  };
  return (
    <Panel icon={Wrench} eyebrow="Capacity" title="Spaces & equipment">
      <div className="mt-5 grid gap-2.5">
        {resources.map(resource => (
          <div
            key={resource.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{resource.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {resource.resourceType} · {resource.capacity} booking at a time
              </p>
            </div>
            <RecordActions
              name={resource.name}
              active={resource.active}
              pending={active.isPending || rename.isPending}
              onToggle={() =>
                active.mutate({
                  resourceId: resource.id,
                  active: !resource.active,
                })
              }
              onRename={value =>
                rename.mutate({ resourceId: resource.id, name: value })
              }
            />
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2"
      >
        <Field label="Resource name">
          <Input
            required
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Room B"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="Resource type">
          <Input
            required
            value={resourceType}
            onChange={event => setType(event.target.value)}
            placeholder="e.g. Treatment room"
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Button
          disabled={create.isPending}
          className="pressable h-10 rounded-xl bg-primary text-primary-foreground sm:col-span-2"
        >
          {create.isPending ? "Saving resource…" : "Add resource"}
        </Button>
      </form>
    </Panel>
  );
}

function AvailabilityManager({
  availability,
  onSaved,
}: {
  availability: Array<{
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    active: boolean;
  }>;
  onSaved: () => void;
}) {
  const defaults = useMemo(
    () =>
      availability.find(rule => rule.dayOfWeek === 1) || {
        dayOfWeek: 1,
        startMinute: 540,
        endMinute: 1080,
        active: true,
      },
    [availability]
  );
  const [day, setDay] = useState(String(defaults.dayOfWeek));
  const [start, setStart] = useState(timeFromMinutes(defaults.startMinute));
  const [end, setEnd] = useState(timeFromMinutes(defaults.endMinute));
  const save = trpc.booking.saveBusinessAvailability.useMutation({
    onSuccess: () => {
      toast.success("Working-hours window added.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({
      dayOfWeek: Number(day),
      startMinute: minutesFromTime(start),
      endMinute: minutesFromTime(end),
      active: true,
    });
  };
  const closeDay = () =>
    save.mutate({
      dayOfWeek: Number(day),
      startMinute: minutesFromTime(start),
      endMinute: minutesFromTime(end),
      active: false,
    });
  return (
    <Panel icon={Clock3} eyebrow="Availability" title="Working hours">
      <div className="mt-5 space-y-2.5">
        {weekdays.map((label, index) => {
          const windows = availability.filter(
            item => item.dayOfWeek === index && item.active
          );
          return (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/65 px-3 py-2.5"
            >
              <span className="text-xs font-semibold">{label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {windows.length
                  ? windows
                      .map(
                        rule =>
                          `${timeFromMinutes(rule.startMinute)}—${timeFromMinutes(rule.endMinute)}`
                      )
                      .join(" · ")
                  : "Closed"}
              </span>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-3"
      >
        <Field label="Day">
          <select
            value={day}
            onChange={event => setDay(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {weekdays.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <Input
            required
            type="time"
            value={start}
            onChange={event => setStart(event.target.value)}
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Field label="To">
          <Input
            required
            type="time"
            value={end}
            onChange={event => setEnd(event.target.value)}
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        <Button
          disabled={save.isPending}
          className="pressable h-10 rounded-xl bg-primary text-primary-foreground sm:col-span-2"
        >
          {save.isPending ? "Saving hours…" : "Add hours window"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={closeDay}
          className="pressable h-10 rounded-xl border-border bg-card text-xs"
        >
          Close this day
        </Button>
      </form>
      <p className="mt-3 flex gap-2 text-[11px] leading-5 text-muted-foreground">
        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Add split windows when a business closes between appointments.
        Availability is enforced before a customer can choose a time.
      </p>
    </Panel>
  );
}

function TargetAvailabilityManager({
  staff,
  resources,
  onSaved,
}: {
  staff: Array<{ id: number; name: string }>;
  resources: Array<{ id: number; name: string }>;
  onSaved: () => void;
}) {
  const [targetType, setTargetType] = useState<"staff" | "resource">("staff");
  const targetOptions = targetType === "staff" ? staff : resources;
  const [targetId, setTargetId] = useState("");
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  useEffect(() => {
    setTargetId(String(targetOptions[0]?.id || ""));
  }, [targetType, targetOptions]);
  const add = trpc.booking.addTargetAvailability.useMutation({
    onSuccess: () => {
      toast.success("Target availability added.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!targetId) return;
    add.mutate({
      targetType,
      targetId: Number(targetId),
      dayOfWeek: Number(day),
      startMinute: minutesFromTime(start),
      endMinute: minutesFromTime(end),
    });
  };
  return (
    <Panel
      icon={Clock3}
      eyebrow="Target availability"
      title="Refine a person or space"
    >
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Optional windows narrow the business hours for a specific team member or
        shared resource. Multiple windows may be added for split shifts.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Applies to">
            <select
              value={targetType}
              onChange={event =>
                setTargetType(event.target.value as "staff" | "resource")
              }
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="staff">Team member</option>
              <option value="resource">Resource</option>
            </select>
          </Field>
          <Field label="Select">
            <select
              required
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {targetOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Day">
            <select
              value={day}
              onChange={event => setDay(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {weekdays.map((label, index) => (
                <option key={label} value={index}>
                  {label.slice(0, 3)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <Input
              required
              type="time"
              value={start}
              onChange={event => setStart(event.target.value)}
              className="h-10 rounded-xl bg-background"
            />
          </Field>
          <Field label="To">
            <Input
              required
              type="time"
              value={end}
              onChange={event => setEnd(event.target.value)}
              className="h-10 rounded-xl bg-background"
            />
          </Field>
        </div>
        <Button
          disabled={add.isPending || !targetId}
          className="pressable h-10 rounded-xl bg-primary text-primary-foreground"
        >
          {add.isPending ? "Adding window…" : "Add availability window"}
        </Button>
      </form>
    </Panel>
  );
}

function DetailedEditManager({
  services,
  staff,
  resources,
  assignments,
  onSaved,
}: {
  services: Array<{
    id: number;
    name: string;
    durationMinutes: number;
    priceCents: number;
    depositCents: number;
  }>;
  staff: Array<{
    id: number;
    name: string;
    roleTitle: string | null;
    email: string | null;
    phone: string | null;
  }>;
  resources: Array<{
    id: number;
    name: string;
    resourceType: string;
    capacity: number;
  }>;
  assignments: Array<{ staffId: number; serviceId: number }>;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"service" | "staff" | "resource">("service");
  const choices =
    kind === "service" ? services : kind === "staff" ? staff : resources;
  const [id, setId] = useState("");
  const selected = choices.find(item => item.id === Number(id)) || choices[0];
  const [name, setName] = useState("");
  const [fieldOne, setFieldOne] = useState("");
  const [fieldTwo, setFieldTwo] = useState("");
  const [fieldThree, setFieldThree] = useState("");
  const [assignedServiceId, setAssignedServiceId] = useState("");
  useEffect(() => {
    setId(String(choices[0]?.id || ""));
  }, [kind, choices]);
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    if (kind === "service") {
      const item = selected as (typeof services)[number];
      setFieldOne(String(item.durationMinutes));
      setFieldTwo(String(item.priceCents / 100));
      setFieldThree(String(item.depositCents / 100));
    } else if (kind === "staff") {
      const item = selected as (typeof staff)[number];
      setFieldOne(item.roleTitle || "");
      setFieldTwo(item.email || "");
      setFieldThree(item.phone || "");
      setAssignedServiceId(
        String(
          assignments.find(assignment => assignment.staffId === item.id)
            ?.serviceId || ""
        )
      );
    } else {
      const item = selected as (typeof resources)[number];
      setFieldOne(item.resourceType);
      setFieldTwo(String(item.capacity));
      setFieldThree("");
    }
  }, [id, kind, selected, assignments]);
  const updateService = trpc.booking.updateService.useMutation({
    onSuccess: () => {
      toast.success("Service details updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const updateStaff = trpc.booking.updateStaffMember.useMutation({
    onSuccess: () => {
      toast.success("Staff details updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const updateResource = trpc.booking.updateResource.useMutation({
    onSuccess: () => {
      toast.success("Resource details updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const recordId = Number(id);
    if (!recordId) return;
    if (kind === "service")
      updateService.mutate({
        serviceId: recordId,
        name,
        durationMinutes: Number(fieldOne),
        priceCents: Math.round(Number(fieldTwo) * 100),
        depositCents: Math.round(Number(fieldThree) * 100),
      });
    else if (kind === "staff")
      updateStaff.mutate({
        staffId: recordId,
        name,
        roleTitle: fieldOne,
        email: fieldTwo,
        phone: fieldThree,
        serviceIds: assignedServiceId ? [Number(assignedServiceId)] : [],
      });
    else
      updateResource.mutate({
        resourceId: recordId,
        name,
        resourceType: fieldOne,
        capacity: Number(fieldTwo),
      });
  };
  const pending =
    updateService.isPending ||
    updateStaff.isPending ||
    updateResource.isPending;
  return (
    <Panel icon={Pencil} eyebrow="Edit records" title="Keep details current">
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Choose an existing record, then update the operational details that
        shape the public booking journey.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Record type">
            <select
              value={kind}
              onChange={event =>
                setKind(event.target.value as "service" | "staff" | "resource")
              }
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="service">Service</option>
              <option value="staff">Team member</option>
              <option value="resource">Resource</option>
            </select>
          </Field>
          <Field label="Record">
            <select
              required
              value={id}
              onChange={event => setId(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {choices.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Name">
          <Input
            required
            value={name}
            onChange={event => setName(event.target.value)}
            className="h-10 rounded-xl bg-background"
          />
        </Field>
        {kind === "service" ? (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Minutes">
              <Input
                required
                type="number"
                min="15"
                value={fieldOne}
                onChange={event => setFieldOne(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
            <Field label="Price KES">
              <Input
                required
                type="number"
                min="0"
                value={fieldTwo}
                onChange={event => setFieldTwo(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
            <Field label="Deposit KES">
              <Input
                required
                type="number"
                min="0"
                value={fieldThree}
                onChange={event => setFieldThree(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
          </div>
        ) : kind === "staff" ? (
          <>
            <Field label="Role">
              <Input
                value={fieldOne}
                onChange={event => setFieldOne(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input
                  type="email"
                  value={fieldTwo}
                  onChange={event => setFieldTwo(event.target.value)}
                  className="h-10 rounded-xl bg-background"
                />
              </Field>
              <Field label="Mobile">
                <Input
                  value={fieldThree}
                  onChange={event => setFieldThree(event.target.value)}
                  className="h-10 rounded-xl bg-background"
                />
              </Field>
            </div>
            <Field label="Offers service">
              <select
                value={assignedServiceId}
                onChange={event => setAssignedServiceId(event.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">No public service assigned</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Resource type">
              <Input
                required
                value={fieldOne}
                onChange={event => setFieldOne(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
            <Field label="Capacity">
              <Input
                required
                type="number"
                min="1"
                value={fieldTwo}
                onChange={event => setFieldTwo(event.target.value)}
                className="h-10 rounded-xl bg-background"
              />
            </Field>
          </div>
        )}
        <Button
          disabled={pending || !id}
          className="pressable h-10 rounded-xl bg-primary text-primary-foreground"
        >
          {pending ? "Updating record…" : "Save record details"}
        </Button>
      </form>
    </Panel>
  );
}

function LifecycleAndReminderManager({
  appointments,
  reminders,
  reminderSettings,
  scheduleActive,
  onSaved,
}: {
  appointments: Array<{
    id: number;
    customerName: string;
    serviceName: string;
    startsAt: number;
    status: "pending" | "paid" | "confirmed" | "cancelled" | "completed";
    paymentStatus: string;
    bookingReference: string;
  }>;
  reminders: Array<{
    id: number;
    appointmentId: number;
    channel: "sms" | "email";
    scheduledFor: number;
    sentAt: number | null;
    status: string;
  }>;
  reminderSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    leadHours: number;
  };
  scheduleActive: boolean;
  onSaved: () => void;
}) {
  const update = trpc.booking.updateAppointmentState.useMutation({
    onSuccess: () => {
      toast.success("Appointment status updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const run = trpc.booking.simulateNextReminderBatch.useMutation({
    onSuccess: result => {
      toast.success(result.message);
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const activate = trpc.booking.activateReminderSimulation.useMutation({
    onSuccess: () => {
      toast.success("Hourly reminder automation is active.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const [settings, setSettings] = useState(reminderSettings);
  useEffect(() => setSettings(reminderSettings), [reminderSettings]);
  const saveSettings = trpc.booking.updateReminderSettings.useMutation({
    onSuccess: () => {
      toast.success("Reminder settings updated.");
      onSaved();
    },
    onError: error => toast.error(error.message),
  });
  const isPreview =
    typeof window !== "undefined" &&
    window.location.hostname.includes("manus.computer");
  const options = (status: string) =>
    status === "paid"
      ? ["confirmed", "cancelled"]
      : status === "confirmed"
        ? ["completed", "cancelled"]
        : status === "pending"
          ? ["cancelled"]
          : [];
  return (
    <Panel
      icon={Sparkles}
      eyebrow="Booking operations"
      title="Lifecycle & reminder log"
    >
      <div className="mt-5 space-y-2.5">
        {appointments.length ? (
          appointments.map(appointment => (
            <div
              key={appointment.id}
              className="rounded-xl border border-border/70 bg-background/65 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">
                    {appointment.customerName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {appointment.serviceName} ·{" "}
                    {new Date(appointment.startsAt).toLocaleString()}
                  </p>
                </div>
                <Badge className="border-[#D9D5CD] bg-secondary text-[10px] capitalize text-foreground">
                  {appointment.status}
                </Badge>
              </div>
              {options(appointment.status).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {options(appointment.status).map(next => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === "cancelled" ? "outline" : "default"}
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          appointmentId: appointment.id,
                          from: appointment.status,
                          to: next as "confirmed" | "cancelled" | "completed",
                        })
                      }
                      className={cn(
                        "pressable h-8 rounded-lg px-3 text-[10px]",
                        next === "cancelled"
                          ? "border-border bg-card"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {next === "confirmed"
                        ? "Confirm booking"
                        : next === "completed"
                          ? "Mark complete"
                          : "Cancel booking"}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[10px] text-muted-foreground">
                  No further lifecycle action is available for this booking.
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            No appointments are currently in this workspace.
          </p>
        )}
      </div>
      <div className="mt-6 border-t border-border/70 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Simulated SMS & email
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Every payment-secured booking writes its reminder plan here.
              Messages are logged only; none are sent externally in this demo.
            </p>
          </div>
          <Button
            disabled={run.isPending}
            onClick={() => run.mutate()}
            variant="outline"
            className="pressable h-9 shrink-0 rounded-xl border-border bg-card text-[10px]"
          >
            {run.isPending ? "Running…" : "Run next batch"}
          </Button>
        </div>
        <form
          onSubmit={event => {
            event.preventDefault();
            saveSettings.mutate(settings);
          }}
          className="mt-4 rounded-xl border border-border/60 bg-background/55 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold">
                <input
                  checked={settings.smsEnabled}
                  onChange={event =>
                    setSettings({
                      ...settings,
                      smsEnabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                  className="size-3.5 accent-primary"
                />
                SMS log
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold">
                <input
                  checked={settings.emailEnabled}
                  onChange={event =>
                    setSettings({
                      ...settings,
                      emailEnabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                  className="size-3.5 accent-primary"
                />
                Email log
              </label>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Lead time
              <select
                value={settings.leadHours}
                onChange={event =>
                  setSettings({
                    ...settings,
                    leadHours: Number(event.target.value),
                  })
                }
                className="h-8 rounded-lg border border-input bg-card px-2 text-[11px]"
              >
                <option value="2">2 hours</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </label>
            <Button
              disabled={
                saveSettings.isPending ||
                (!settings.smsEnabled && !settings.emailEnabled)
              }
              className="pressable h-8 rounded-lg bg-primary px-3 text-[10px] text-primary-foreground"
            >
              {saveSettings.isPending ? "Saving…" : "Save rules"}
            </Button>
          </div>
        </form>
        <div className="mt-4 space-y-2">
          {reminders.slice(0, 6).map(reminder => (
            <div
              key={reminder.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/55 px-3 py-2.5"
            >
              <span className="text-[11px] font-semibold uppercase">
                {reminder.channel}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                {appointments.find(
                  appointment => appointment.id === reminder.appointmentId
                )?.customerName || "Booking"}{" "}
                · {new Date(reminder.scheduledFor).toLocaleString()}
              </span>
              <Badge
                className={
                  reminder.status === "simulated_sent"
                    ? "border-[#C9D4B3] bg-[#E3E8D7] text-[9px] text-[#40502F]"
                    : reminder.status === "cancelled"
                      ? "border-[#E9CBC6] bg-[#FBEFEE] text-[9px] text-[#914941]"
                      : "border-[#D9D5CD] bg-secondary text-[9px] text-foreground"
                }
              >
                {reminder.status === "simulated_sent"
                  ? "Logged"
                  : reminder.status}
              </Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-secondary/55 p-3">
          <p className="flex gap-2 text-[10px] leading-5 text-muted-foreground">
            <Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {scheduleActive
              ? "Hourly simulator is active for this published workspace."
              : isPreview
                ? "Publish this application first, then activate its authenticated hourly runner."
                : "Activate the hourly runner to process reminder records automatically."}
          </p>
          {scheduleActive ? (
            <Badge className="border-[#C9D4B3] bg-[#E3E8D7] text-[9px] text-[#40502F]">
              Active
            </Badge>
          ) : (
            <Button
              disabled={isPreview || activate.isPending}
              onClick={() => activate.mutate()}
              className="pressable h-8 shrink-0 rounded-lg bg-primary px-3 text-[10px] text-primary-foreground"
            >
              {isPreview
                ? "Publish first"
                : activate.isPending
                  ? "Activating…"
                  : "Activate"}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ManageSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <div className="space-y-3 pl-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-11 w-[min(620px,80vw)]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-96 rounded-[1.4rem]" />
        ))}
      </div>
    </div>
  );
}
