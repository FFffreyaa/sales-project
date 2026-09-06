ALTER TABLE `sales_projects` ADD `project_grade_reason` text;
--> statement-breakpoint
ALTER TABLE `sales_projects` ADD `project_grade_evidence` text;
--> statement-breakpoint
ALTER TABLE `project_strategy_versions` ADD `strategy_payload` text;
--> statement-breakpoint
CREATE TABLE `project_milestones` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `milestone_type` text NOT NULL,
  `owner_name` text NOT NULL,
  `planned_at` text NOT NULL,
  `actual_at` text,
  `status` text DEFAULT 'planned' NOT NULL,
  `completion_criteria` text NOT NULL,
  `evidence_requirement` text NOT NULL,
  `evidence_ref` text,
  `dependency_ref` text,
  `source_type` text DEFAULT 'management' NOT NULL,
  `source_ref` text,
  `change_reason` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  CONSTRAINT `project_milestones_status_ck` CHECK (`status` in ('planned','in_progress','blocked','completed','cancelled')),
  CONSTRAINT `project_milestones_source_ck` CHECK (`source_type` in ('management','gate','external_event'))
);
--> statement-breakpoint
CREATE INDEX `project_milestones_project_date_idx` ON `project_milestones` (`project_id`,`planned_at`);
