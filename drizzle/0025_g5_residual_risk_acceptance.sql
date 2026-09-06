CREATE TABLE `gate_risk_acceptances` (
  `id` text PRIMARY KEY NOT NULL,
  `risk_id` text NOT NULL REFERENCES `project_risks`(`id`),
  `gate_instance_id` text NOT NULL REFERENCES `stage_gate_instances`(`id`),
  `gate_version` integer NOT NULL,
  `risk_version` integer NOT NULL,
  `risk_level` text NOT NULL CHECK (`risk_level` IN ('高','重大')),
  `acceptance_reason` text NOT NULL,
  `accepted_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `gate_risk_acceptances_risk_gate_version_uq` ON `gate_risk_acceptances` (`risk_id`,`gate_instance_id`,`gate_version`);
CREATE INDEX `gate_risk_acceptances_gate_idx` ON `gate_risk_acceptances` (`gate_instance_id`,`gate_version`);
--> statement-breakpoint
PRAGMA optimize;
