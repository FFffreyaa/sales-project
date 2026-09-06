CREATE TABLE `gate_submission_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_instance_id` text NOT NULL,
	`submission_version` integer NOT NULL,
	`input_snapshot` text NOT NULL,
	`submitted_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`gate_instance_id`) REFERENCES `stage_gate_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gate_submission_snapshots_gate_idx` ON `gate_submission_snapshots` (`gate_instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gate_submission_snapshots_version_uq` ON `gate_submission_snapshots` (`gate_instance_id`,`submission_version`);