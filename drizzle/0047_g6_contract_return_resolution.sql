CREATE TABLE `contract_handover_returns` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `gate_instance_id` text NOT NULL,
  `gate_version` integer NOT NULL,
  `award_baseline_id` text NOT NULL,
  `difference_summary` text NOT NULL,
  `remediation_requirement` text NOT NULL,
  `return_evidence_ref` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `resolution_summary` text,
  `resolution_evidence_ref` text,
  `resolved_by` text,
  `resolved_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`),
  FOREIGN KEY (`gate_instance_id`) REFERENCES `stage_gate_instances`(`id`),
  FOREIGN KEY (`award_baseline_id`) REFERENCES `commercial_award_baselines`(`id`),
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`)
);
CREATE UNIQUE INDEX `contract_handover_returns_gate_version_uq`
  ON `contract_handover_returns` (`gate_instance_id`,`gate_version`);
CREATE INDEX `contract_handover_returns_project_status_idx`
  ON `contract_handover_returns` (`project_id`,`status`);
