CREATE TABLE `lead_requirement_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_system` text NOT NULL,
	`lead_id` text NOT NULL,
	`lead_code` text NOT NULL,
	`snapshot_version` integer DEFAULT 1 NOT NULL,
	`original_text` text NOT NULL,
	`requirement_snapshot` text NOT NULL,
	`source_refs` text NOT NULL,
	`field_provenance` text NOT NULL,
	`source_occurred_at` text NOT NULL,
	`immutable` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `lead_requirement_snapshots_immutable_ck` CHECK(`immutable` = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_requirement_snapshots_project_uq` ON `lead_requirement_snapshots` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_requirement_snapshots_source_uq` ON `lead_requirement_snapshots` (`source_system`,`lead_id`,`snapshot_version`);
