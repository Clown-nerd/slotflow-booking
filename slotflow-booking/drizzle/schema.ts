import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const targetTypeEnum = pgEnum("target_type", [
  "business",
  "staff",
  "resource",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "paid",
  "confirmed",
  "cancelled",
  "completed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
]);

export const providerEnum = pgEnum("provider", ["mpesa_simulator", "mpesa"]);

export const depositStatusEnum = pgEnum("deposit_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
]);

export const channelEnum = pgEnum("channel", ["sms", "email"]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "scheduled",
  "simulated_sent",
  "cancelled",
]);

// ─── Tables ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const businesses = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 140 }).notNull(),
    bookingSlug: varchar("bookingSlug", { length: 96 }).notNull(),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Africa/Nairobi"),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("businesses_owner_unique").on(table.ownerId),
    uniqueIndex("businesses_slug_unique").on(table.bookingSlug),
    index("businesses_reminder_cron_idx").on(table.scheduleCronTaskUid),
  ]
);

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    durationMinutes: integer("durationMinutes").notNull(),
    priceCents: integer("priceCents").notNull(),
    depositCents: integer("depositCents").notNull().default(0),
    color: varchar("color", { length: 16 }).notNull().default("#71805B"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("services_business_active_idx").on(table.businessId, table.active),
  ]
);

export const staffMembers = pgTable(
  "staffMembers",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    roleTitle: varchar("roleTitle", { length: 100 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    color: varchar("color", { length: 16 }).notNull().default("#71805B"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("staff_business_active_idx").on(table.businessId, table.active),
  ]
);

export const resources = pgTable(
  "resources",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    resourceType: varchar("resourceType", { length: 60 }).notNull(),
    capacity: integer("capacity").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("resources_business_active_idx").on(table.businessId, table.active),
  ]
);

export const staffServices = pgTable(
  "staffServices",
  {
    staffId: integer("staffId")
      .notNull()
      .references(() => staffMembers.id),
    serviceId: integer("serviceId")
      .notNull()
      .references(() => services.id),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.serviceId] }),
    index("staff_services_service_idx").on(table.serviceId),
  ]
);

export const availabilityRules = pgTable(
  "availabilityRules",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    targetType: targetTypeEnum("targetType")
      .notNull()
      .default("business"),
    targetId: integer("targetId"),
    dayOfWeek: integer("dayOfWeek").notNull(),
    startMinute: integer("startMinute").notNull(),
    endMinute: integer("endMinute").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("availability_lookup_idx").on(
      table.businessId,
      table.targetType,
      table.targetId,
      table.dayOfWeek
    ),
  ]
);

export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    serviceId: integer("serviceId")
      .notNull()
      .references(() => services.id),
    staffId: integer("staffId")
      .notNull()
      .references(() => staffMembers.id),
    resourceId: integer("resourceId").references(() => resources.id),
    customerName: varchar("customerName", { length: 120 }).notNull(),
    customerEmail: varchar("customerEmail", { length: 320 }),
    customerPhone: varchar("customerPhone", { length: 32 }).notNull(),
    startsAt: bigint("startsAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }).notNull(),
    status: appointmentStatusEnum("status")
      .notNull()
      .default("pending"),
    totalCents: integer("totalCents").notNull(),
    depositCents: integer("depositCents").notNull().default(0),
    paymentStatus: paymentStatusEnum("paymentStatus")
      .notNull()
      .default("pending"),
    bookingReference: varchar("bookingReference", { length: 28 }).notNull(),
    notes: text("notes"),
    expiresAt: bigint("expiresAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("appointments_reference_unique").on(table.bookingReference),
    index("appointments_business_start_idx").on(
      table.businessId,
      table.startsAt
    ),
    index("appointments_staff_start_idx").on(table.staffId, table.startsAt),
    index("appointments_resource_start_idx").on(
      table.resourceId,
      table.startsAt
    ),
  ]
);

export const depositPayments = pgTable(
  "depositPayments",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id),
    provider: providerEnum("provider")
      .notNull()
      .default("mpesa_simulator"),
    providerReference: varchar("providerReference", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    amountCents: integer("amountCents").notNull(),
    status: depositStatusEnum("status")
      .notNull()
      .default("pending"),
    requestedAt: bigint("requestedAt", { mode: "number" }).notNull(),
    completedAt: bigint("completedAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("payments_provider_reference_unique").on(
      table.providerReference
    ),
    index("payments_appointment_idx").on(table.appointmentId),
  ]
);

export const reminderSettings = pgTable(
  "reminderSettings",
  {
    id: serial("id").primaryKey(),
    businessId: integer("businessId")
      .notNull()
      .references(() => businesses.id),
    smsEnabled: boolean("smsEnabled").notNull().default(true),
    emailEnabled: boolean("emailEnabled").notNull().default(true),
    leadHours: integer("leadHours").notNull().default(24),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reminder_settings_business_unique").on(table.businessId),
  ]
);

export const reminderEvents = pgTable(
  "reminderEvents",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id),
    channel: channelEnum("channel").notNull(),
    scheduledFor: bigint("scheduledFor", { mode: "number" }).notNull(),
    sentAt: bigint("sentAt", { mode: "number" }),
    status: reminderStatusEnum("status")
      .notNull()
      .default("scheduled"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("reminder_unique_event").on(
      table.appointmentId,
      table.channel,
      table.scheduledFor
    ),
    index("reminders_due_idx").on(table.status, table.scheduledFor),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type Service = typeof services.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type ReminderSettings = typeof reminderSettings.$inferSelect;
