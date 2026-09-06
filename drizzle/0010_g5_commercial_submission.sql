CREATE TABLE `pricing_authorizations` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `version` integer NOT NULL,
  `costing_solution_version_id` text NOT NULL REFERENCES `costing_solution_versions`(`id`),
  `floor_price_cents` integer NOT NULL,
  `authorized_quote_price_cents` integer NOT NULL,
  `route_scope` text NOT NULL,
  `valid_until` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'effective' NOT NULL,
  `authorized_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`floor_price_cents` > 0 AND `authorized_quote_price_cents` >= `floor_price_cents`)
);
CREATE UNIQUE INDEX `pricing_authorizations_uq` ON `pricing_authorizations` (`project_id`,`version`);
CREATE INDEX `pricing_authorizations_project_idx` ON `pricing_authorizations` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `bid_package_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `version` integer NOT NULL,
  `costing_solution_version_id` text NOT NULL REFERENCES `costing_solution_versions`(`id`),
  `pricing_authorization_id` text NOT NULL REFERENCES `pricing_authorizations`(`id`),
  `submission_type` text NOT NULL,
  `route_id` text NOT NULL,
  `quoted_price_cents` integer NOT NULL,
  `package_hash` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'prepared' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`quoted_price_cents` > 0)
);
CREATE UNIQUE INDEX `bid_package_versions_uq` ON `bid_package_versions` (`project_id`,`version`);
CREATE UNIQUE INDEX `bid_package_versions_hash_uq` ON `bid_package_versions` (`package_hash`);
CREATE INDEX `bid_package_versions_project_idx` ON `bid_package_versions` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `professional_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `bid_package_version_id` text NOT NULL REFERENCES `bid_package_versions`(`id`),
  `conclusion` text NOT NULL,
  `open_risk_count` integer NOT NULL,
  `deviation_conclusion` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `reviewed_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`open_risk_count` >= 0),
  CHECK (`deviation_conclusion` IN ('none','authorized'))
);
CREATE UNIQUE INDEX `professional_reviews_package_uq` ON `professional_reviews` (`bid_package_version_id`);
--> statement-breakpoint
CREATE TABLE `commercial_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `gate_instance_id` text NOT NULL REFERENCES `stage_gate_instances`(`id`),
  `gate_version` integer NOT NULL,
  `bid_package_version_id` text NOT NULL REFERENCES `bid_package_versions`(`id`),
  `submission_type` text NOT NULL,
  `route_id` text NOT NULL,
  `quoted_price_cents` integer NOT NULL,
  `package_hash` text NOT NULL,
  `submitted_by` text NOT NULL REFERENCES `users`(`id`),
  `submitted_at` text NOT NULL,
  `receipt_ref` text NOT NULL,
  `receipt_hash` text NOT NULL,
  `status` text DEFAULT 'accepted' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `commercial_submissions_gate_version_uq` ON `commercial_submissions` (`gate_instance_id`,`gate_version`);
CREATE UNIQUE INDEX `commercial_submissions_receipt_uq` ON `commercial_submissions` (`receipt_ref`);
CREATE INDEX `commercial_submissions_project_idx` ON `commercial_submissions` (`project_id`,`created_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-bid','bid','投标专员');
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('bid-specialist-sun','孙投标');
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('bid-specialist-sun','role-bid');
--> statement-breakpoint
INSERT OR IGNORE INTO `audit_records` (`id`,`project_id`,`category`,`action`,`before_state`,`after_state`,`actor_user_id`)
SELECT 'MIG10-AUDIT-' || g.`id`,g.`project_id`,'数据修复','撤销缺少价格授权事实的历史G4通过',
  json_object('stage',p.`stage`,'gateStatus',g.`status`),
  json_object('stage','S3','gateStatus','returned','reason','历史G4缺少底价、授权范围和有效期；请补充后重新提交'),
  'authorizer-luo'
FROM `stage_gate_instances` g JOIN `sales_projects` p ON p.`id`=g.`project_id`
WHERE g.`gate_code`='G4' AND g.`status`='approved'
  AND NOT EXISTS (SELECT 1 FROM `pricing_authorizations` a WHERE a.`project_id`=g.`project_id` AND a.`status`='effective');
--> statement-breakpoint
INSERT OR IGNORE INTO `domain_events` (`id`,`aggregate_type`,`aggregate_id`,`event_type`,`payload`,`actor_user_id`)
SELECT 'MIG10-EVENT-' || g.`id`,'StageGateInteraction',g.`id`,'G4Returned',
  json_object('stage','S3','gateStatus','returned','reason','历史G4缺少价格授权事实，迁移回退后重新授权'),
  'authorizer-luo'
FROM `stage_gate_instances` g
WHERE g.`gate_code`='G4' AND g.`status`='approved'
  AND NOT EXISTS (SELECT 1 FROM `pricing_authorizations` a WHERE a.`project_id`=g.`project_id` AND a.`status`='effective');
--> statement-breakpoint
UPDATE `stage_gate_instances`
SET `status`='returned',`decision_comment`='历史G4缺少底价、授权范围和有效期；请补充后重新提交',`updated_at`=CURRENT_TIMESTAMP
WHERE `gate_code`='G4' AND `status`='approved'
  AND NOT EXISTS (SELECT 1 FROM `pricing_authorizations` a WHERE a.project_id=`stage_gate_instances`.`project_id` AND a.status='effective');
--> statement-breakpoint
UPDATE `sales_projects`
SET `stage`='S3',`stage_name`='核价评审',`lifecycle_status`='核价定价中',`updated_at`=CURRENT_TIMESTAMP,`version`=`version`+1
WHERE `stage`='S4'
  AND NOT EXISTS (SELECT 1 FROM `pricing_authorizations` a WHERE a.project_id=`sales_projects`.`id` AND a.status='effective');
