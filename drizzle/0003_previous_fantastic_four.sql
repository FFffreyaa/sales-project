CREATE TABLE `customer_relationship_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`layer` text NOT NULL,
	`person_name` text NOT NULL,
	`title` text NOT NULL,
	`attitude` text NOT NULL,
	`influence` text NOT NULL,
	`owner_name` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`last_touch_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_relationship_records_layer_ck" CHECK("customer_relationship_records"."layer" in ('客户高层','商务决策链','技术层'))
);
--> statement-breakpoint
CREATE INDEX `customer_relationship_records_project_idx` ON `customer_relationship_records` (`project_id`,`layer`);--> statement-breakpoint
CREATE TABLE `project_strategy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision_preference` text NOT NULL,
	`objective` text NOT NULL,
	`competitive_assessment` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_strategy_versions_uq` ON `project_strategy_versions` (`project_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_strategy_versions_project_idx` ON `project_strategy_versions` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`role_name` text NOT NULL,
	`assignee_name` text NOT NULL,
	`status` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`evidence_ref` text NOT NULL,
	`accepted_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_assignments_project_role_uq` ON `role_assignments` (`project_id`,`role_name`);--> statement-breakpoint
CREATE INDEX `role_assignments_project_idx` ON `role_assignments` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `solution_preparation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`requirement_gaps` text NOT NULL,
	`technical_difficulty` text NOT NULL,
	`solution_resource_needs` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`source_system` text DEFAULT 'TEST_BID_ADAPTER' NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `solution_preparation_records_uq` ON `solution_preparation_records` (`project_id`,`version`);--> statement-breakpoint
CREATE INDEX `solution_preparation_records_project_idx` ON `solution_preparation_records` (`project_id`,`status`);