CREATE TABLE `customer_requirement_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`version` integer NOT NULL,
	`original_text` text NOT NULL,
	`source_ref` text NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `customer_requirement_versions_uq` ON `customer_requirement_versions` (`project_id`,`version`);
CREATE INDEX `customer_requirement_versions_project_idx` ON `customer_requirement_versions` (`project_id`,`status`);

CREATE TABLE `technical_solution_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`version` integer NOT NULL,
	`requirement_version_id` text NOT NULL REFERENCES `customer_requirement_versions`(`id`),
	`standardized_requirement` text NOT NULL,
	`design_adopted_value` text NOT NULL,
	`critical_parameter_status` text NOT NULL CHECK (`critical_parameter_status` in ('完整','存在缺失')),
	`initial_technical_solution` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`approved_by` text REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `technical_solution_versions_uq` ON `technical_solution_versions` (`project_id`,`version`);
CREATE INDEX `technical_solution_versions_project_idx` ON `technical_solution_versions` (`project_id`,`status`);

CREATE TABLE `technical_clarification_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`requirement_version_id` text NOT NULL REFERENCES `customer_requirement_versions`(`id`),
	`solution_version_id` text NOT NULL REFERENCES `technical_solution_versions`(`id`),
	`question` text NOT NULL,
	`response` text NOT NULL,
	`status` text NOT NULL CHECK (`status` in ('open','resolved')),
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `technical_clarification_items_project_idx` ON `technical_clarification_items` (`project_id`,`status`);

CREATE TABLE `technical_deviation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`solution_version_id` text NOT NULL REFERENCES `technical_solution_versions`(`id`),
	`description` text NOT NULL,
	`status` text NOT NULL CHECK (`status` in ('none','recorded')),
	`evidence_ref` text NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `technical_deviation_records_project_idx` ON `technical_deviation_records` (`project_id`,`status`);

CREATE TABLE `stage_exit_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`source_stage` text NOT NULL,
	`target_stage` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` in ('pending','returned','approved')),
	`snapshot` text NOT NULL,
	`requested_by` text NOT NULL REFERENCES `users`(`id`),
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_by` text REFERENCES `users`(`id`),
	`review_comment` text,
	`reviewed_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `stage_exit_reviews_project_stage_uq` ON `stage_exit_reviews` (`project_id`,`source_stage`);
CREATE INDEX `stage_exit_reviews_status_idx` ON `stage_exit_reviews` (`status`,`source_stage`);

CREATE TABLE `stage_exit_review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL REFERENCES `stage_exit_reviews`(`id`),
	`review_version` integer NOT NULL,
	`decision` text NOT NULL,
	`comment` text NOT NULL,
	`actor_user_id` text NOT NULL REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `stage_exit_review_decisions_review_idx` ON `stage_exit_review_decisions` (`review_id`);
CREATE UNIQUE INDEX `stage_exit_review_decisions_version_uq` ON `stage_exit_review_decisions` (`review_id`,`review_version`);

-- 将旧G3一次性工作包拆成不可变来源版本；旧记录仍保留，只作为历史审计。
INSERT INTO `customer_requirement_versions` (`id`,`project_id`,`version`,`original_text`,`source_ref`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'MIG-REQ-' || g.id,g.project_id,1,json_extract(s.input_snapshot,'$.requirementSourceText'),json_extract(s.input_snapshot,'$.requirementSourceRef'),'effective',s.submitted_by,s.created_at,s.created_at
FROM stage_gate_instances g
JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id
WHERE g.gate_code='G3' AND s.submission_version=(SELECT MAX(s2.submission_version) FROM gate_submission_snapshots s2 WHERE s2.gate_instance_id=g.id)
  AND COALESCE(json_extract(s.input_snapshot,'$.requirementSourceText'),'')<>'';

INSERT INTO `technical_solution_versions` (`id`,`project_id`,`version`,`requirement_version_id`,`standardized_requirement`,`design_adopted_value`,`critical_parameter_status`,`initial_technical_solution`,`evidence_ref`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'MIG-SOL-' || g.id,g.project_id,1,'MIG-REQ-' || g.id,json_extract(s.input_snapshot,'$.standardizedRequirement'),json_extract(s.input_snapshot,'$.designAdoptedValue'),json_extract(s.input_snapshot,'$.criticalParameterStatus'),json_extract(s.input_snapshot,'$.initialTechnicalSolution'),json_extract(s.input_snapshot,'$.requirementSourceRef'),'effective',s.submitted_by,s.created_at,s.created_at
FROM stage_gate_instances g
JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id
WHERE g.gate_code='G3' AND s.submission_version=(SELECT MAX(s2.submission_version) FROM gate_submission_snapshots s2 WHERE s2.gate_instance_id=g.id)
  AND EXISTS (SELECT 1 FROM customer_requirement_versions r WHERE r.id='MIG-REQ-' || g.id);

INSERT INTO `technical_clarification_items` (`id`,`project_id`,`requirement_version_id`,`solution_version_id`,`question`,`response`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'MIG-CLR-' || g.id,g.project_id,'MIG-REQ-' || g.id,'MIG-SOL-' || g.id,json_extract(s.input_snapshot,'$.clarificationItems'),'旧数据未记录结构化答复','open',s.submitted_by,s.created_at,s.created_at
FROM stage_gate_instances g JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id
WHERE g.gate_code='G3' AND s.submission_version=(SELECT MAX(s2.submission_version) FROM gate_submission_snapshots s2 WHERE s2.gate_instance_id=g.id)
  AND EXISTS (SELECT 1 FROM technical_solution_versions t WHERE t.id='MIG-SOL-' || g.id);

INSERT INTO `technical_deviation_records` (`id`,`project_id`,`solution_version_id`,`description`,`status`,`evidence_ref`,`created_by`,`created_at`,`updated_at`)
SELECT 'MIG-DEV-' || g.id,g.project_id,'MIG-SOL-' || g.id,json_extract(s.input_snapshot,'$.deviationList'),'recorded',json_extract(s.input_snapshot,'$.requirementSourceRef'),s.submitted_by,s.created_at,s.created_at
FROM stage_gate_instances g JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id
WHERE g.gate_code='G3' AND s.submission_version=(SELECT MAX(s2.submission_version) FROM gate_submission_snapshots s2 WHERE s2.gate_instance_id=g.id)
  AND EXISTS (SELECT 1 FROM technical_solution_versions t WHERE t.id='MIG-SOL-' || g.id);

INSERT INTO `stage_exit_reviews` (`id`,`project_id`,`source_stage`,`target_stage`,`status`,`snapshot`,`requested_by`,`requested_at`,`review_comment`,`version`,`created_at`,`updated_at`)
SELECT 'MIG-EXIT-' || g.id,g.project_id,'S2','S3','returned',json_object('legacyGateId',g.id,'migration','旧G3工作包已拆分为S2来源对象'),g.requested_by,g.requested_at,'旧G3工作包已迁移为S2来源对象，请核对后重新提交技术确认',1,g.created_at,CURRENT_TIMESTAMP
FROM stage_gate_instances g
WHERE g.gate_code='G3' AND EXISTS (SELECT 1 FROM customer_requirement_versions r WHERE r.project_id=g.project_id);
