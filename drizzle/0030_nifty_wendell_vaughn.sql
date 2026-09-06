ALTER TABLE `lead_conversion_inbox` ADD `grade_assessment` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `major_project` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `major_project_basis` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `authenticity_basis` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `submitter_snapshot` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `business_context` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `customer_master_snapshot` text;
--> statement-breakpoint
ALTER TABLE `lead_conversion_inbox` ADD `attachment_snapshot` text DEFAULT '[]' NOT NULL;
