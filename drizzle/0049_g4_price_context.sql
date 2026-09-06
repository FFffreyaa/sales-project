ALTER TABLE `pricing_snapshot_versions` ADD COLUMN `source_version` text;
ALTER TABLE `pricing_snapshot_versions` ADD COLUMN `tax_basis` text;
ALTER TABLE `pricing_snapshot_versions` ADD COLUMN `trade_terms` text;
ALTER TABLE `pricing_snapshot_versions` ADD COLUMN `exchange_rate_basis` text;

ALTER TABLE `pricing_authorizations` ADD COLUMN `pricing_snapshot_id` text REFERENCES `pricing_snapshot_versions`(`id`);
ALTER TABLE `pricing_authorizations` ADD COLUMN `currency` text;
ALTER TABLE `pricing_authorizations` ADD COLUMN `tax_basis` text;
ALTER TABLE `pricing_authorizations` ADD COLUMN `trade_terms` text;
ALTER TABLE `pricing_authorizations` ADD COLUMN `exception_conditions` text;

CREATE TABLE `price_authorization_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `gate_instance_id` text NOT NULL,
  `gate_version` integer NOT NULL,
  `costing_solution_version_id` text NOT NULL,
  `pricing_snapshot_id` text NOT NULL,
  `proposed_quote_price_cents` integer NOT NULL,
  `currency` text NOT NULL,
  `tax_basis` text NOT NULL,
  `trade_terms` text NOT NULL,
  `proposed_route_scope` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `requested_by` text NOT NULL,
  `decided_authorization_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`),
  FOREIGN KEY (`gate_instance_id`) REFERENCES `stage_gate_instances`(`id`),
  FOREIGN KEY (`costing_solution_version_id`) REFERENCES `costing_solution_versions`(`id`),
  FOREIGN KEY (`pricing_snapshot_id`) REFERENCES `pricing_snapshot_versions`(`id`),
  FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`decided_authorization_id`) REFERENCES `pricing_authorizations`(`id`)
);
CREATE UNIQUE INDEX `price_authorization_requests_gate_version_uq`
  ON `price_authorization_requests` (`gate_instance_id`,`gate_version`);
CREATE INDEX `price_authorization_requests_project_status_idx`
  ON `price_authorization_requests` (`project_id`,`status`);
