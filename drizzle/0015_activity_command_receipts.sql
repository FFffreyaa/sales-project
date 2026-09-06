CREATE TABLE `activity_command_receipts` (
  `command_id` text PRIMARY KEY NOT NULL,
  `activity_instance_id` text NOT NULL REFERENCES `activity_instances`(`id`),
  `actor_user_id` text NOT NULL REFERENCES `users`(`id`),
  `command` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `expected_version` integer NOT NULL,
  `resulting_version` integer NOT NULL,
  `resulting_status` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_command_receipts_activity_idx` ON `activity_command_receipts` (`activity_instance_id`,`created_at`);
