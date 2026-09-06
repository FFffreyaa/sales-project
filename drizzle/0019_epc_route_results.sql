CREATE TABLE `quotation_route_results` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `route_id` text NOT NULL,
  `commercial_submission_id` text NOT NULL REFERENCES `commercial_submissions`(`id`),
  `result_type` text NOT NULL CHECK (`result_type` IN ('won','lost')),
  `source_system` text NOT NULL,
  `source_ref` text NOT NULL,
  `notice_date` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `award_scope` text,
  `competitor_name` text,
  `status` text DEFAULT 'effective' NOT NULL CHECK (`status` IN ('effective','superseded')),
  `recorded_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_route_results_source_uq` ON `quotation_route_results` (`source_system`,`source_ref`);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_route_results_route_effective_uq` ON `quotation_route_results` (`route_id`) WHERE `status`='effective';
--> statement-breakpoint
CREATE INDEX `quotation_route_results_project_status_idx` ON `quotation_route_results` (`project_id`,`status`);
--> statement-breakpoint
CREATE INDEX `quotation_route_results_route_status_idx` ON `quotation_route_results` (`route_id`,`status`);
--> statement-breakpoint
PRAGMA optimize;
