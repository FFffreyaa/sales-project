CREATE TABLE `requirement_clarification_packages` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `version` integer NOT NULL,
  `original_text` text NOT NULL,
  `source_ref` text NOT NULL,
  `status` text NOT NULL DEFAULT 'effective',
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `requirement_clarification_packages_status_ck` CHECK (`status` in ('effective','superseded'))
);
CREATE UNIQUE INDEX `requirement_clarification_packages_uq` ON `requirement_clarification_packages` (`project_id`,`version`);
CREATE INDEX `requirement_clarification_packages_project_idx` ON `requirement_clarification_packages` (`project_id`,`status`);
ALTER TABLE `customer_requirement_versions` ADD COLUMN `clarification_package_id` text REFERENCES `requirement_clarification_packages`(`id`);
