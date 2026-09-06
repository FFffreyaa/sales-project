ALTER TABLE `gate_decisions` ADD `gate_version` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `gate_decisions_gate_version_uq` ON `gate_decisions` (`gate_instance_id`,`gate_version`);