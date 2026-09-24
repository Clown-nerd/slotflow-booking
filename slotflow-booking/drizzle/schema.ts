import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const businesses = mysqlTable(
  "businesses",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("businesses_owner_unique").on(table.ownerId),
    uniqueIndex("businesses_slug_unique").on(table.bookingSlug),
    index("businesses_reminder_cron_idx").on(table.scheduleCronTaskUid),
  ]
);

export const services = mysqlTable(
  "services",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    durationMinutes: int("durationMinutes").notNull(),
    priceCents: int("priceCents").notNull(),
    depositCents: int("depositCents").notNull().default(0),
    color: varchar("color", { length: 16 }).notNull().default("#71805B"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("services_business_active_idx").on(table.businessId, table.active),
  ]
);

export const staffMembers = mysqlTable(
  "staffMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    roleTitle: varchar("roleTitle", { length: 100 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    color: varchar("color", { length: 16 }).notNull().default("#71805B"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("staff_business_active_idx").on(table.businessId, table.active),
  ]
);

export const resources = mysqlTable(
  "resources",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    resourceType: varchar("resourceType", { length: 60 }).notNull(),
    capacity: int("capacity").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("resources_business_active_idx").on(table.businessId, table.active),
  ]
);

export const staffServices = mysqlTable(
  "staffServices",
  {
    staffId: int("staffId")
      .notNull()
      .references(() => staffMembers.id),
    serviceId: int("serviceId")
      .notNull()
      .references(() => services.id),
  },
  table => [
    primaryKey({ columns: [table.staffId, table.serviceId] }),
    index("staff_services_service_idx").on(table.serviceId),
  ]
);

export const availabilityRules = mysqlTable(
  "availabilityRules",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    targetType: mysqlEnum("targetType", ["business", "staff", "resource"])
      .notNull()
      .default("business"),
    targetId: int("targetId"),
    dayOfWeek: int("dayOfWeek").notNull(),
    startMinute: int("startMinute").notNull(),
    endMinute: int("endMinute").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("availability_lookup_idx").on(
      table.businessId,
      table.targetType,
      table.targetId,
      table.dayOfWeek
    ),
  ]
);

export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    serviceId: int("serviceId")
      .notNull()
      .references(() => services.id),
    staffId: int("staffId")
      .notNull()
      .references(() => staffMembers.id),
    resourceId: int("resourceId").references(() => resources.id),
    customerName: varchar("customerName", { length: 120 }).notNull(),
    customerEmail: varchar("customerEmail", { length: 320 }),
    customerPhone: varchar("customerPhone", { length: 32 }).notNull(),
    startsAt: bigint("startsAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "paid",
      "confirmed",
      "cancelled",
      "completed",
    ])
      .notNull()
      .default("pending"),
    totalCents: int("totalCents").notNull(),
    depositCents: int("depositCents").notNull().default(0),
    paymentStatus: mysqlEnum("paymentStatus", [
      "pending",
      "paid",
      "failed",
      "cancelled",
    ])
      .notNull()
      .default("pending"),
    bookingReference: varchar("bookingReference", { length: 28 }).notNull(),
    notes: text("notes"),
    expiresAt: bigint("expiresAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
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

export const depositPayments = mysqlTable(
  "depositPayments",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id),
    provider: mysqlEnum("provider", ["mpesa_simulator", "mpesa"])
      .notNull()
      .default("mpesa_simulator"),
    providerReference: varchar("providerReference", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["pending", "paid", "failed", "cancelled"])
      .notNull()
      .default("pending"),
    requestedAt: bigint("requestedAt", { mode: "number" }).notNull(),
    completedAt: bigint("completedAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("payments_provider_reference_unique").on(
      table.providerReference
    ),
    index("payments_appointment_idx").on(table.appointmentId),
  ]
);

export const reminderSettings = mysqlTable(
  "reminderSettings",
  {
    id: int("id").autoincrement().primaryKey(),
    businessId: int("businessId")
      .notNull()
      .references(() => businesses.id),
    smsEnabled: boolean("smsEnabled").notNull().default(true),
    emailEnabled: boolean("emailEnabled").notNull().default(true),
    leadHours: int("leadHours").notNull().default(24),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("reminder_settings_business_unique").on(table.businessId),
  ]
);

export const reminderEvents = mysqlTable(
  "reminderEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id),
    channel: mysqlEnum("channel", ["sms", "email"]).notNull(),
    scheduledFor: bigint("scheduledFor", { mode: "number" }).notNull(),
    sentAt: bigint("sentAt", { mode: "number" }),
    status: mysqlEnum("status", ["scheduled", "simulated_sent", "cancelled"])
      .notNull()
      .default("scheduled"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
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
