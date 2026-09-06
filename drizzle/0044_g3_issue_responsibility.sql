ALTER TABLE `technical_clarification_items` ADD COLUMN `owner_role` text;
ALTER TABLE `technical_clarification_items` ADD COLUMN `closure_evidence_ref` text;
ALTER TABLE `technical_clarification_items` ADD COLUMN `closed_by` text REFERENCES `users`(`id`);

ALTER TABLE `technical_deviation_records` ADD COLUMN `owner_role` text;
ALTER TABLE `technical_deviation_records` ADD COLUMN `disposition` text;
ALTER TABLE `technical_deviation_records` ADD COLUMN `closure_evidence_ref` text;
ALTER TABLE `technical_deviation_records` ADD COLUMN `closed_by` text REFERENCES `users`(`id`);
