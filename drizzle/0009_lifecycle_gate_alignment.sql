ALTER TABLE `stage_gate_instances` ADD COLUMN `definition_version` text NOT NULL DEFAULT 'LIFECYCLE_GATE_V1';
--> statement-breakpoint
ALTER TABLE `stage_gate_instances` ADD COLUMN `migrated_from` text;
--> statement-breakpoint

-- 原V1.2的G3/G4/G5语义与生命周期出口不一致，保留历史但移出当前Gate编码。
UPDATE `stage_gate_instances`
SET `gate_code`='LEGACY_G3_V12',`definition_version`='DP02_V12',`migrated_from`='G3',`updated_at`=CURRENT_TIMESTAMP
WHERE `gate_code`='G3';
--> statement-breakpoint
UPDATE `stage_gate_instances`
SET `gate_code`='LEGACY_G4_V12',`definition_version`='DP02_V12',`migrated_from`='G4',`updated_at`=CURRENT_TIMESTAMP
WHERE `gate_code`='G4';
--> statement-breakpoint
UPDATE `stage_gate_instances`
SET `gate_code`='LEGACY_G5_V12',`definition_version`='DP02_V12',`migrated_from`='G5',`updated_at`=CURRENT_TIMESTAMP
WHERE `gate_code`='G5';
--> statement-breakpoint

-- 将已运行的S2/S3出口审核无损迁移为新G3/G4 Gate；原表继续只读保留历史。
INSERT OR IGNORE INTO `stage_gate_instances`
(`id`,`project_id`,`gate_code`,`source_stage`,`target_stage`,`status`,`requested_by`,`requested_at`,`decided_by`,`decision_comment`,`decided_at`,`version`,`created_at`,`updated_at`,`definition_version`,`migrated_from`)
SELECT r.id,r.project_id,CASE r.source_stage WHEN 'S2' THEN 'G3' ELSE 'G4' END,r.source_stage,r.target_stage,r.status,r.requested_by,r.requested_at,r.reviewed_by,r.review_comment,r.reviewed_at,r.version,r.created_at,r.updated_at,'LIFECYCLE_GATE_V1','stage_exit_reviews'
FROM `stage_exit_reviews` r
WHERE r.source_stage IN ('S2','S3');
--> statement-breakpoint

INSERT OR IGNORE INTO `gate_submission_snapshots`
(`id`,`gate_instance_id`,`submission_version`,`input_snapshot`,`submitted_by`,`created_at`)
SELECT 'MIG9-SNAPSHOT-' || r.id,r.id,r.version,r.snapshot,r.requested_by,r.requested_at
FROM `stage_exit_reviews` r
WHERE r.source_stage IN ('S2','S3')
  AND EXISTS (SELECT 1 FROM `stage_gate_instances` g WHERE g.id=r.id);
--> statement-breakpoint

INSERT OR IGNORE INTO `gate_decisions`
(`id`,`gate_instance_id`,`gate_version`,`decision`,`comment`,`actor_user_id`,`created_at`)
SELECT 'MIG9-DECISION-' || d.id,d.review_id,d.review_version,d.decision,d.comment,d.actor_user_id,d.created_at
FROM `stage_exit_review_decisions` d
WHERE EXISTS (SELECT 1 FROM `stage_gate_instances` g WHERE g.id=d.review_id);
--> statement-breakpoint

UPDATE `external_tasks`
SET `task_type`=CASE `task_type` WHEN 'S2_EXIT_REVIEW' THEN 'G3_GATE_REVIEW' ELSE 'G4_GATE_REVIEW' END,
    `updated_at`=CURRENT_TIMESTAMP
WHERE `task_type` IN ('S2_EXIT_REVIEW','S3_EXIT_REVIEW');
