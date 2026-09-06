CREATE TABLE `lead_conversion_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`lead_code` text NOT NULL,
	`source_system` text NOT NULL,
	`lead_type` text NOT NULL,
	`lead_grade` text,
	`lead_score` integer,
	`authenticity_status` text NOT NULL,
	`source_channel` text NOT NULL,
	`assigned_owner_external_id` text,
	`assigned_owner_name` text,
	`customer_name` text NOT NULL,
	`final_customer_name` text,
	`project_name` text NOT NULL,
	`region` text,
	`industry` text,
	`product_scope` text NOT NULL,
	`quantity` text,
	`amount_type` text DEFAULT 'unknown' NOT NULL,
	`amount_min_cents` integer,
	`amount_max_cents` integer,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`procurement_progress` text,
	`suggested_scenario_code` text,
	`request_ref` text,
	`request_date` text,
	`tender_no` text,
	`lot_no` text,
	`delivery_location` text,
	`submission_deadline` text,
	`evidence_refs` text NOT NULL,
	`contact_snapshot` text NOT NULL,
	`followup_snapshot` text NOT NULL,
	`source_snapshot` text NOT NULL,
	`field_provenance` text NOT NULL,
	`status` text DEFAULT 'pending_confirmation' NOT NULL,
	`converted_project_id` text,
	`converted_by` text,
	`converted_at` text,
	`processing_error` text,
	`environment` text DEFAULT 'demo' NOT NULL,
	`simulated` integer DEFAULT true NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`converted_project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`converted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lead_conversion_inbox_type_ck" CHECK(`lead_type` in ('tender','demand')),
	CONSTRAINT "lead_conversion_inbox_grade_ck" CHECK(`lead_grade` is null or `lead_grade` in ('S','A','B','C')),
	CONSTRAINT "lead_conversion_inbox_amount_type_ck" CHECK(`amount_type` in ('exact','range','unknown')),
	CONSTRAINT "lead_conversion_inbox_status_ck" CHECK(`status` in ('pending_confirmation','auto_converted','manually_converted','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_conversion_inbox_event_uq` ON `lead_conversion_inbox` (`event_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_conversion_inbox_source_lead_uq` ON `lead_conversion_inbox` (`source_system`,`lead_id`);
--> statement-breakpoint
CREATE INDEX `lead_conversion_inbox_status_owner_idx` ON `lead_conversion_inbox` (`status`,`assigned_owner_external_id`);
--> statement-breakpoint
CREATE TABLE `project_source_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_system` text NOT NULL,
	`source_object_type` text NOT NULL,
	`source_object_id` text NOT NULL,
	`source_object_code` text,
	`relation_type` text NOT NULL,
	`source_snapshot` text NOT NULL,
	`field_provenance` text NOT NULL,
	`imported_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_source_links_source_uq` ON `project_source_links` (`source_system`,`source_object_type`,`source_object_id`);
--> statement-breakpoint
CREATE INDEX `project_source_links_project_idx` ON `project_source_links` (`project_id`,`relation_type`);
--> statement-breakpoint
CREATE TABLE `bid_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`round_no` integer NOT NULL,
	`round_type` text DEFAULT 'initial' NOT NULL,
	`external_bid_id` text,
	`authority_system` text DEFAULT 'BID_MANAGEMENT_APP' NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`tender_document_ref` text NOT NULL,
	`tender_document_version` text,
	`tender_document_hash` text,
	`bid_deadline` text NOT NULL,
	`source_event_id` text,
	`source_snapshot` text NOT NULL,
	`latest_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bid_rounds_type_ck" CHECK(`round_type` in ('initial','rebid','supplement')),
	CONSTRAINT "bid_rounds_status_ck" CHECK(`status` in ('registered','active','on_hold','submitted','resulted','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_rounds_project_round_uq` ON `bid_rounds` (`project_id`,`round_no`);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_rounds_external_uq` ON `bid_rounds` (`authority_system`,`external_bid_id`);
--> statement-breakpoint
CREATE INDEX `bid_rounds_project_status_idx` ON `bid_rounds` (`project_id`,`status`);
