CREATE TABLE `audit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`before_state` text,
	`after_state` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_records_project_idx` ON `audit_records` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `domain_events` (
	`id` text PRIMARY KEY NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `domain_events_aggregate_idx` ON `domain_events` (`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE TABLE `gate_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_instance_id` text NOT NULL,
	`decision` text NOT NULL,
	`comment` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`gate_instance_id`) REFERENCES `stage_gate_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gate_decisions_gate_idx` ON `gate_decisions` (`gate_instance_id`);--> statement-breakpoint
CREATE TABLE `procurement_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_type` text NOT NULL,
	`evidence` text NOT NULL,
	`customer_name` text NOT NULL,
	`target` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`bid_date` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`duplicate_status` text DEFAULT 'clear' NOT NULL,
	`source_snapshot` text NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "procurement_intents_amount_nonnegative" CHECK("procurement_intents"."amount_cents" >= 0),
	CONSTRAINT "procurement_intents_duplicate_status_ck" CHECK("procurement_intents"."duplicate_status" in ('clear','suspected','confirmed_distinct','merge_required'))
);
--> statement-breakpoint
CREATE INDEX `procurement_intents_customer_idx` ON `procurement_intents` (`customer_name`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_uq` ON `roles` (`code`);--> statement-breakpoint
CREATE TABLE `sales_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`project_code` text NOT NULL,
	`procurement_intent_id` text NOT NULL,
	`name` text NOT NULL,
	`customer_name` text NOT NULL,
	`target` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`project_grade` text NOT NULL,
	`organization` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`stage` text DEFAULT 'S0' NOT NULL,
	`stage_name` text DEFAULT '待立项' NOT NULL,
	`lifecycle_status` text DEFAULT '待立项' NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`administrative_status` text DEFAULT 'Active' NOT NULL,
	`bid_date` text NOT NULL,
	`evidence` text NOT NULL,
	`detail_snapshot` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`procurement_intent_id`) REFERENCES `procurement_intents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_projects_stage_ck" CHECK("sales_projects"."stage" in ('S0','S1','S2','S3','S4','S5','S6'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_projects_code_uq` ON `sales_projects` (`project_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_projects_intent_uq` ON `sales_projects` (`procurement_intent_id`);--> statement-breakpoint
CREATE INDEX `sales_projects_owner_stage_idx` ON `sales_projects` (`owner_user_id`,`stage`);--> statement-breakpoint
CREATE TABLE `stage_gate_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`gate_code` text NOT NULL,
	`source_stage` text NOT NULL,
	`target_stage` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_by` text,
	`decision_comment` text,
	`decided_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stage_gate_instances_status_ck" CHECK("stage_gate_instances"."status" in ('pending','returned','approved'))
);
--> statement-breakpoint
CREATE INDEX `stage_gate_instances_project_idx` ON `stage_gate_instances` (`project_id`,`gate_code`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
