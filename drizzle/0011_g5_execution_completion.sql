ALTER TABLE `stage_gate_instances` ADD COLUMN `execution_status` text NOT NULL DEFAULT 'not_required' CHECK (`execution_status` IN ('not_required','executing','completed'));
--> statement-breakpoint
ALTER TABLE `stage_gate_instances` ADD COLUMN `completed_at` text;
--> statement-breakpoint
UPDATE `stage_gate_instances`
SET `execution_status`='completed',`completed_at`=COALESCE((SELECT s.`created_at` FROM `commercial_submissions` s WHERE s.`gate_instance_id`=`stage_gate_instances`.`id` AND s.`gate_version`=`stage_gate_instances`.`version` LIMIT 1),CURRENT_TIMESTAMP)
WHERE `gate_code`='G5' AND EXISTS (SELECT 1 FROM `commercial_submissions` s WHERE s.`gate_instance_id`=`stage_gate_instances`.`id` AND s.`gate_version`=`stage_gate_instances`.`version`);
