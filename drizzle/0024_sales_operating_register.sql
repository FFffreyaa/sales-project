CREATE TABLE `resource_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `role_name` text NOT NULL,
  `requirement` text NOT NULL,
  `required_by` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','assigned','fulfilled','cancelled')),
  `requested_by` text NOT NULL REFERENCES `users`(`id`),
  `assignment_id` text REFERENCES `role_assignments`(`id`),
  `fulfilled_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `resource_requests_project_status_idx` ON `resource_requests` (`project_id`,`status`);
CREATE UNIQUE INDEX `resource_requests_project_role_open_uq` ON `resource_requests` (`project_id`,`role_name`) WHERE `status` IN ('pending','assigned');
--> statement-breakpoint
CREATE TABLE `project_risks` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `category` text NOT NULL,
  `title` text NOT NULL,
  `level` text NOT NULL CHECK (`level` IN ('低','中','高','重大')),
  `description` text NOT NULL,
  `impact` text NOT NULL,
  `owner_name` text NOT NULL,
  `due_date` text NOT NULL,
  `status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','mitigating','closed')),
  `evidence_ref` text NOT NULL,
  `resolution` text,
  `closure_evidence_ref` text,
  `mitigation_activity_id` text REFERENCES `activity_instances`(`id`),
  `closed_by` text REFERENCES `users`(`id`),
  `closed_at` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `project_risks_project_status_idx` ON `project_risks` (`project_id`,`status`,`level`);
--> statement-breakpoint
CREATE TABLE `project_risk_transitions` (
  `id` text PRIMARY KEY NOT NULL,
  `risk_id` text NOT NULL REFERENCES `project_risks`(`id`),
  `from_status` text,
  `to_status` text NOT NULL,
  `reason` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `actor_user_id` text NOT NULL REFERENCES `users`(`id`),
  `occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `project_risk_transitions_risk_idx` ON `project_risk_transitions` (`risk_id`,`occurred_at`);
--> statement-breakpoint
PRAGMA optimize;
