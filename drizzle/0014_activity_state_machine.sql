ALTER TABLE `activity_instances` ADD `last_command_id` text;
--> statement-breakpoint
ALTER TABLE `activity_evidence_refs` ADD `source_command_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_evidence_refs_command_uq` ON `activity_evidence_refs` (`source_command_id`) WHERE `source_command_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `activity_transitions` ADD `command_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_transitions_command_uq` ON `activity_transitions` (`command_id`) WHERE `command_id` IS NOT NULL;
