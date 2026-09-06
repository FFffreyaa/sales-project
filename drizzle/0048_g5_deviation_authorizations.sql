CREATE TABLE `g5_deviation_authorizations` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `gate_instance_id` text NOT NULL,
  `gate_version` integer NOT NULL,
  `deviation_ref` text NOT NULL,
  `deviation_source_type` text NOT NULL,
  `scope` text NOT NULL,
  `risk` text NOT NULL,
  `applicable_version_id` text NOT NULL,
  `valid_until` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `authorized_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`),
  FOREIGN KEY (`gate_instance_id`) REFERENCES `stage_gate_instances`(`id`),
  FOREIGN KEY (`authorized_by`) REFERENCES `users`(`id`)
);

CREATE UNIQUE INDEX `g5_deviation_authorizations_gate_version_ref_uq`
  ON `g5_deviation_authorizations` (`gate_instance_id`,`gate_version`,`deviation_ref`);
CREATE INDEX `g5_deviation_authorizations_project_version_idx`
  ON `g5_deviation_authorizations` (`project_id`,`gate_version`);
