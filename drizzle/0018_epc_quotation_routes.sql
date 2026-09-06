CREATE TABLE `quotation_routes` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `epc_customer` text NOT NULL,
  `inquiry_ref` text NOT NULL,
  `inquiry_date` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active','withdrawn','closed')),
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_routes_project_customer_uq` ON `quotation_routes` (`project_id`,`epc_customer`);
--> statement-breakpoint
CREATE INDEX `quotation_routes_project_status_idx` ON `quotation_routes` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `epc_price_exceptions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `route_id` text NOT NULL REFERENCES `quotation_routes`(`id`),
  `pricing_authorization_id` text NOT NULL REFERENCES `pricing_authorizations`(`id`),
  `requested_price_cents` integer NOT NULL CHECK (`requested_price_cents` > 0),
  `reason` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `valid_until` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','approved','returned','rejected','superseded')),
  `requested_by` text NOT NULL REFERENCES `users`(`id`),
  `decided_by` text REFERENCES `users`(`id`),
  `decision_comment` text,
  `decided_at` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `epc_price_exceptions_route_status_idx` ON `epc_price_exceptions` (`route_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `epc_price_exceptions_route_open_uq` ON `epc_price_exceptions` (`route_id`) WHERE `status` IN ('pending','approved');
--> statement-breakpoint
DROP INDEX `commercial_submissions_gate_version_uq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `commercial_submissions_gate_version_route_uq` ON `commercial_submissions` (`gate_instance_id`,`gate_version`,`route_id`);
--> statement-breakpoint
PRAGMA optimize;
