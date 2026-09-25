CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'paid', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('mpesa_simulator', 'mpesa');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('scheduled', 'simulated_sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('business', 'staff', 'resource');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"staffId" integer NOT NULL,
	"resourceId" integer,
	"customerName" varchar(120) NOT NULL,
	"customerEmail" varchar(320),
	"customerPhone" varchar(32) NOT NULL,
	"startsAt" bigint NOT NULL,
	"endsAt" bigint NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"totalCents" integer NOT NULL,
	"depositCents" integer DEFAULT 0 NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'pending' NOT NULL,
	"bookingReference" varchar(28) NOT NULL,
	"notes" text,
	"expiresAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availabilityRules" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"targetType" "target_type" DEFAULT 'business' NOT NULL,
	"targetId" integer,
	"dayOfWeek" integer NOT NULL,
	"startMinute" integer NOT NULL,
	"endMinute" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"name" varchar(140) NOT NULL,
	"bookingSlug" varchar(96) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Nairobi' NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depositPayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointmentId" integer NOT NULL,
	"provider" "provider" DEFAULT 'mpesa_simulator' NOT NULL,
	"providerReference" varchar(80) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"amountCents" integer NOT NULL,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"requestedAt" bigint NOT NULL,
	"completedAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointmentId" integer NOT NULL,
	"channel" "channel" NOT NULL,
	"scheduledFor" bigint NOT NULL,
	"sentAt" bigint,
	"status" "reminder_status" DEFAULT 'scheduled' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"smsEnabled" boolean DEFAULT true NOT NULL,
	"emailEnabled" boolean DEFAULT true NOT NULL,
	"leadHours" integer DEFAULT 24 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"resourceType" varchar(60) NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"durationMinutes" integer NOT NULL,
	"priceCents" integer NOT NULL,
	"depositCents" integer DEFAULT 0 NOT NULL,
	"color" varchar(16) DEFAULT '#71805B' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staffMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"roleTitle" varchar(100),
	"email" varchar(320),
	"phone" varchar(32),
	"color" varchar(16) DEFAULT '#71805B' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staffServices" (
	"staffId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	CONSTRAINT "staffServices_staffId_serviceId_pk" PRIMARY KEY("staffId","serviceId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staffId_staffMembers_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staffMembers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_resourceId_resources_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availabilityRules" ADD CONSTRAINT "availabilityRules_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositPayments" ADD CONSTRAINT "depositPayments_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminderEvents" ADD CONSTRAINT "reminderEvents_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminderSettings" ADD CONSTRAINT "reminderSettings_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffMembers" ADD CONSTRAINT "staffMembers_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffServices" ADD CONSTRAINT "staffServices_staffId_staffMembers_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staffMembers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffServices" ADD CONSTRAINT "staffServices_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_reference_unique" ON "appointments" USING btree ("bookingReference");--> statement-breakpoint
CREATE INDEX "appointments_business_start_idx" ON "appointments" USING btree ("businessId","startsAt");--> statement-breakpoint
CREATE INDEX "appointments_staff_start_idx" ON "appointments" USING btree ("staffId","startsAt");--> statement-breakpoint
CREATE INDEX "appointments_resource_start_idx" ON "appointments" USING btree ("resourceId","startsAt");--> statement-breakpoint
CREATE INDEX "availability_lookup_idx" ON "availabilityRules" USING btree ("businessId","targetType","targetId","dayOfWeek");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_owner_unique" ON "businesses" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_unique" ON "businesses" USING btree ("bookingSlug");--> statement-breakpoint
CREATE INDEX "businesses_reminder_cron_idx" ON "businesses" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_unique" ON "depositPayments" USING btree ("providerReference");--> statement-breakpoint
CREATE INDEX "payments_appointment_idx" ON "depositPayments" USING btree ("appointmentId");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_unique_event" ON "reminderEvents" USING btree ("appointmentId","channel","scheduledFor");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminderEvents" USING btree ("status","scheduledFor");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_settings_business_unique" ON "reminderSettings" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "resources_business_active_idx" ON "resources" USING btree ("businessId","active");--> statement-breakpoint
CREATE INDEX "services_business_active_idx" ON "services" USING btree ("businessId","active");--> statement-breakpoint
CREATE INDEX "staff_business_active_idx" ON "staffMembers" USING btree ("businessId","active");--> statement-breakpoint
CREATE INDEX "staff_services_service_idx" ON "staffServices" USING btree ("serviceId");