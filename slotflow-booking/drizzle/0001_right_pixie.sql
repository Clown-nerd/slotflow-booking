CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`serviceId` int NOT NULL,
	`staffId` int NOT NULL,
	`resourceId` int,
	`customerName` varchar(120) NOT NULL,
	`customerEmail` varchar(320),
	`customerPhone` varchar(32) NOT NULL,
	`startsAt` bigint NOT NULL,
	`endsAt` bigint NOT NULL,
	`status` enum('pending','paid','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
	`totalCents` int NOT NULL,
	`depositCents` int NOT NULL DEFAULT 0,
	`paymentStatus` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
	`bookingReference` varchar(28) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointments_reference_unique` UNIQUE(`bookingReference`)
);
--> statement-breakpoint
CREATE TABLE `availabilityRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`targetType` enum('business','staff','resource') NOT NULL DEFAULT 'business',
	`targetId` int,
	`dayOfWeek` int NOT NULL,
	`startMinute` int NOT NULL,
	`endMinute` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `availabilityRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`bookingSlug` varchar(96) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Africa/Nairobi',
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`),
	CONSTRAINT `businesses_owner_unique` UNIQUE(`ownerId`),
	CONSTRAINT `businesses_slug_unique` UNIQUE(`bookingSlug`)
);
--> statement-breakpoint
CREATE TABLE `depositPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`provider` enum('mpesa_simulator','mpesa') NOT NULL DEFAULT 'mpesa_simulator',
	`providerReference` varchar(80) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`amountCents` int NOT NULL,
	`status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
	`requestedAt` bigint NOT NULL,
	`completedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depositPayments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_provider_reference_unique` UNIQUE(`providerReference`)
);
--> statement-breakpoint
CREATE TABLE `reminderEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`channel` enum('sms','email') NOT NULL,
	`scheduledFor` bigint NOT NULL,
	`sentAt` bigint,
	`status` enum('scheduled','simulated_sent','cancelled') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminderEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_unique_event` UNIQUE(`appointmentId`,`channel`,`scheduledFor`)
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`resourceType` varchar(60) NOT NULL,
	`capacity` int NOT NULL DEFAULT 1,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`durationMinutes` int NOT NULL,
	`priceCents` int NOT NULL,
	`depositCents` int NOT NULL DEFAULT 0,
	`color` varchar(16) NOT NULL DEFAULT '#71805B',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`roleTitle` varchar(100),
	`email` varchar(320),
	`phone` varchar(32),
	`color` varchar(16) NOT NULL DEFAULT '#71805B',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffServices` (
	`staffId` int NOT NULL,
	`serviceId` int NOT NULL,
	CONSTRAINT `staffServices_staffId_serviceId_pk` PRIMARY KEY(`staffId`,`serviceId`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_businessId_businesses_id_fk` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_staffId_staffMembers_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staffMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_resourceId_resources_id_fk` FOREIGN KEY (`resourceId`) REFERENCES `resources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `availabilityRules` ADD CONSTRAINT `availabilityRules_businessId_businesses_id_fk` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `depositPayments` ADD CONSTRAINT `depositPayments_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminderEvents` ADD CONSTRAINT `reminderEvents_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `resources` ADD CONSTRAINT `resources_businessId_businesses_id_fk` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_businessId_businesses_id_fk` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffMembers` ADD CONSTRAINT `staffMembers_businessId_businesses_id_fk` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffServices` ADD CONSTRAINT `staffServices_staffId_staffMembers_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staffMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staffServices` ADD CONSTRAINT `staffServices_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointments_business_start_idx` ON `appointments` (`businessId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `appointments_staff_start_idx` ON `appointments` (`staffId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `appointments_resource_start_idx` ON `appointments` (`resourceId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `availability_lookup_idx` ON `availabilityRules` (`businessId`,`targetType`,`targetId`,`dayOfWeek`);--> statement-breakpoint
CREATE INDEX `businesses_reminder_cron_idx` ON `businesses` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `depositPayments` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminderEvents` (`status`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `resources_business_active_idx` ON `resources` (`businessId`,`active`);--> statement-breakpoint
CREATE INDEX `services_business_active_idx` ON `services` (`businessId`,`active`);--> statement-breakpoint
CREATE INDEX `staff_business_active_idx` ON `staffMembers` (`businessId`,`active`);--> statement-breakpoint
CREATE INDEX `staff_services_service_idx` ON `staffServices` (`serviceId`);