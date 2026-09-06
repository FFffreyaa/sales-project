CREATE TABLE `commercial_result_notices` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `commercial_submission_id` text REFERENCES `commercial_submissions`(`id`),
  `result_type` text NOT NULL CHECK (`result_type` IN ('won','lost','terminated')),
  `source_system` text NOT NULL,
  `source_ref` text NOT NULL,
  `notice_date` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `award_scope` text,
  `competitor_name` text,
  `status` text DEFAULT 'effective' NOT NULL CHECK (`status` IN ('effective','superseded')),
  `recorded_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `commercial_result_notices_source_uq` ON `commercial_result_notices` (`source_system`,`source_ref`);
CREATE INDEX `commercial_result_notices_project_idx` ON `commercial_result_notices` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `loss_termination_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `result_notice_id` text NOT NULL REFERENCES `commercial_result_notices`(`id`),
  `result_type` text NOT NULL CHECK (`result_type` IN ('lost','terminated')),
  `reason_category` text NOT NULL,
  `reason_detail` text NOT NULL,
  `competitor_name` text,
  `key_gap` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `improvement_action` text NOT NULL,
  `action_owner` text NOT NULL,
  `due_date` text NOT NULL,
  `status` text DEFAULT 'ready' NOT NULL CHECK (`status` IN ('draft','ready','closed')),
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `loss_termination_reviews_notice_uq` ON `loss_termination_reviews` (`result_notice_id`);
CREATE INDEX `loss_termination_reviews_project_idx` ON `loss_termination_reviews` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `commercial_award_baselines` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `gate_instance_id` text NOT NULL REFERENCES `stage_gate_instances`(`id`),
  `gate_version` integer NOT NULL,
  `result_notice_id` text NOT NULL REFERENCES `commercial_result_notices`(`id`),
  `requirement_version_id` text NOT NULL REFERENCES `customer_requirement_versions`(`id`),
  `technical_solution_version_id` text NOT NULL REFERENCES `technical_solution_versions`(`id`),
  `design_bom_version_id` text NOT NULL REFERENCES `quotation_design_bom_versions`(`id`),
  `costing_solution_version_id` text NOT NULL REFERENCES `costing_solution_versions`(`id`),
  `pricing_authorization_id` text NOT NULL REFERENCES `pricing_authorizations`(`id`),
  `bid_package_version_id` text NOT NULL REFERENCES `bid_package_versions`(`id`),
  `commercial_submission_id` text NOT NULL REFERENCES `commercial_submissions`(`id`),
  `deviation_snapshot` text NOT NULL,
  `commitment_snapshot` text NOT NULL,
  `manifest_hash` text NOT NULL,
  `status` text DEFAULT 'frozen' NOT NULL CHECK (`status` IN ('frozen','transferred')),
  `approved_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `transferred_at` text
);
CREATE UNIQUE INDEX `commercial_award_baselines_gate_uq` ON `commercial_award_baselines` (`gate_instance_id`,`gate_version`);
CREATE UNIQUE INDEX `commercial_award_baselines_manifest_uq` ON `commercial_award_baselines` (`manifest_hash`);
CREATE INDEX `commercial_award_baselines_project_idx` ON `commercial_award_baselines` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `contract_handover_receipts` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `gate_instance_id` text NOT NULL REFERENCES `stage_gate_instances`(`id`),
  `gate_version` integer NOT NULL,
  `award_baseline_id` text NOT NULL REFERENCES `commercial_award_baselines`(`id`),
  `manifest_hash` text NOT NULL,
  `contract_ref` text NOT NULL,
  `receipt_ref` text NOT NULL,
  `receipt_hash` text NOT NULL,
  `received_by` text NOT NULL REFERENCES `users`(`id`),
  `received_at` text NOT NULL,
  `status` text DEFAULT 'accepted' NOT NULL CHECK (`status` IN ('accepted','rejected')),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `contract_handover_receipts_gate_uq` ON `contract_handover_receipts` (`gate_instance_id`,`gate_version`);
CREATE UNIQUE INDEX `contract_handover_receipts_ref_uq` ON `contract_handover_receipts` (`receipt_ref`);
--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-contract','contract','合同管理员');
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('contract-admin-liu','刘倩');
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('contract-admin-liu','role-contract');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_tasks` (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`)
SELECT 'MIG12-RESULT-' || p.`id`,p.`id`,'COMMERCIAL_RESULT_TRACKING','BID_COLLABORATION_SIMULATOR','RESULT-' || substr(p.`project_code`,-6) || '-01','bid-specialist-sun','孙投标','pending','demo',1,
  json_object('projectCode',p.`project_code`,'commercialSubmissionId',s.`id`,'submissionReceiptRef',s.`receipt_ref`,'reason','迁移既有S5已提交项目，补建L2.9结果跟踪任务','environment','demo','simulated',json('true'))
FROM `sales_projects` p JOIN `commercial_submissions` s ON s.`project_id`=p.`id`
WHERE p.`stage`='S5' AND p.`result`='pending'
  AND NOT EXISTS (SELECT 1 FROM `external_tasks` t WHERE t.`project_id`=p.`id` AND t.`task_type`='COMMERCIAL_RESULT_TRACKING');
--> statement-breakpoint
INSERT OR IGNORE INTO `integration_outbox` (`id`,`project_id`,`event_id`,`event_type`,`target_system`,`external_task_id`,`payload`,`status`,`attempts`)
SELECT 'MIG12-OUT-' || p.`id`,p.`id`,'MIG12-EVT-' || p.`id`,'CommercialResultTrackingRequested','BID_COLLABORATION_SIMULATOR','RESULT-' || substr(p.`project_code`,-6) || '-01',
  json_object('eventId','MIG12-EVT-' || p.`id`,'eventType','CommercialResultTrackingRequested','sourceSystem','SALES_PROJECT_APP','targetSystem','BID_COLLABORATION_SIMULATOR','projectCode',p.`project_code`,'externalTaskId','RESULT-' || substr(p.`project_code`,-6) || '-01','environment','demo','simulated',json('true')),
  'pending',0
FROM `sales_projects` p JOIN `commercial_submissions` s ON s.`project_id`=p.`id`
WHERE p.`stage`='S5' AND p.`result`='pending';
