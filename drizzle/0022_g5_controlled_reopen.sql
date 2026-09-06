CREATE TABLE `g5_reopen_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `gate_instance_id` text NOT NULL REFERENCES `stage_gate_instances`(`id`),
  `gate_version` integer NOT NULL,
  `change_type` text NOT NULL CHECK (`change_type` IN ('add_route','withdraw_route','route_material_change','route_price_change')),
  `route_id` text,
  `reason` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','approved','returned','rejected')),
  `requested_by` text NOT NULL REFERENCES `users`(`id`),
  `decided_by` text REFERENCES `users`(`id`),
  `decision_comment` text,
  `decided_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `g5_reopen_requests_project_status_idx` ON `g5_reopen_requests` (`project_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `g5_reopen_requests_project_open_uq` ON `g5_reopen_requests` (`project_id`) WHERE `status` = 'pending';
--> statement-breakpoint
PRAGMA optimize;
