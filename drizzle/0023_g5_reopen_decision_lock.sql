CREATE TABLE `g5_reopen_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL REFERENCES `g5_reopen_requests`(`id`),
  `decision` text NOT NULL CHECK (`decision` IN ('approve','return','reject')),
  `comment` text NOT NULL,
  `actor_user_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `g5_reopen_decisions_request_uq` ON `g5_reopen_decisions` (`request_id`);
--> statement-breakpoint
PRAGMA optimize;
