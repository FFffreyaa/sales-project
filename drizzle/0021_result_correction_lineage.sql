ALTER TABLE `quotation_route_results` ADD COLUMN `supersedes_result_id` text;
--> statement-breakpoint
ALTER TABLE `quotation_route_results` ADD COLUMN `correction_reason` text;
--> statement-breakpoint
CREATE INDEX `quotation_route_results_supersedes_idx` ON `quotation_route_results` (`supersedes_result_id`);
--> statement-breakpoint
PRAGMA optimize;
