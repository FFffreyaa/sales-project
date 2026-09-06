CREATE TABLE `resource_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`role_name` text NOT NULL,
	`candidate_name` text NOT NULL,
	`source_system` text NOT NULL,
	`source_ref` text NOT NULL,
	`capabilities` text NOT NULL,
	`load_percent` integer,
	`active_project_count` integer,
	`available_from` text,
	`status` text DEFAULT 'candidate' NOT NULL,
	`evidence_ref` text NOT NULL,
	`proposed_by` text NOT NULL,
	`selected_by` text,
	`selected_at` text,
	`environment` text DEFAULT 'demo' NOT NULL,
	`simulated` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resource_candidates_status_ck" CHECK(`status` in ('candidate','selected','rejected','withdrawn')),
	CONSTRAINT "resource_candidates_load_ck" CHECK(`load_percent` is null or (`load_percent` >= 0 and `load_percent` <= 100))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_candidates_project_role_name_uq` ON `resource_candidates` (`project_id`,`role_name`,`candidate_name`);
--> statement-breakpoint
CREATE INDEX `resource_candidates_project_role_idx` ON `resource_candidates` (`project_id`,`role_name`,`status`);
