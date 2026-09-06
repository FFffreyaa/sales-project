CREATE TABLE `quotation_design_bom_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`version` integer NOT NULL,
	`technical_solution_version_id` text NOT NULL REFERENCES `technical_solution_versions`(`id`),
	`configuration_summary` text NOT NULL,
	`confirmation_status` text NOT NULL CHECK (`confirmation_status` in ('confirmed','unconfirmed')),
	`evidence_ref` text NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`approved_by` text REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `quotation_design_bom_versions_uq` ON `quotation_design_bom_versions` (`project_id`,`version`);
CREATE INDEX `quotation_design_bom_versions_project_idx` ON `quotation_design_bom_versions` (`project_id`,`status`);

CREATE TABLE `pricing_snapshot_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`version` integer NOT NULL,
	`source` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`valid_until` text NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`evidence_ref` text NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `pricing_snapshot_versions_uq` ON `pricing_snapshot_versions` (`project_id`,`version`);
CREATE INDEX `pricing_snapshot_versions_project_idx` ON `pricing_snapshot_versions` (`project_id`,`status`);

CREATE TABLE `costing_solution_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`version` integer NOT NULL,
	`technical_solution_version_id` text NOT NULL REFERENCES `technical_solution_versions`(`id`),
	`design_bom_version_id` text NOT NULL REFERENCES `quotation_design_bom_versions`(`id`),
	`pricing_snapshot_id` text NOT NULL REFERENCES `pricing_snapshot_versions`(`id`),
	`material_cost_cents` integer NOT NULL,
	`labor_cost_cents` integer NOT NULL,
	`manufacturing_cost_cents` integer NOT NULL,
	`transport_cost_cents` integer NOT NULL,
	`tax_cost_cents` integer NOT NULL,
	`risk_reserve_cents` integer NOT NULL,
	`costing_sales_price_cents` integer NOT NULL,
	`target_profit_rate_bp` integer NOT NULL,
	`gross_margin_bp` integer NOT NULL,
	`calculation_basis` text NOT NULL,
	`delivery_assessment` text NOT NULL,
	`delivery_risk_conclusion` text NOT NULL,
	`status` text DEFAULT 'effective' NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`approved_by` text REFERENCES `users`(`id`),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CHECK (`material_cost_cents` >= 0 and `labor_cost_cents` >= 0 and `manufacturing_cost_cents` >= 0 and `transport_cost_cents` >= 0 and `tax_cost_cents` >= 0 and `risk_reserve_cents` >= 0 and `costing_sales_price_cents` > 0)
);
CREATE UNIQUE INDEX `costing_solution_versions_uq` ON `costing_solution_versions` (`project_id`,`version`);
CREATE INDEX `costing_solution_versions_project_idx` ON `costing_solution_versions` (`project_id`,`status`);

INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-costing','costing','核价人员');
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-authorizer','authorizer','财务授权人');
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('costing-liu','刘工');
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('authorizer-luo','罗总');
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('costing-liu','role-costing');
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('authorizer-luo','role-authorizer');

-- 为迁移前已进入S3、但尚无核价作业的项目建立外部任务；不伪造任何核价结论。
INSERT INTO `external_tasks` (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`,`created_at`,`updated_at`)
SELECT 'MIG-S3-TASK-' || p.id,p.id,'COSTING_COLLABORATION','COSTING_COLLABORATION_SIMULATOR','COST-' || substr(p.project_code,-6) || '-01','costing-liu','刘工','pending','demo',1,json_object('projectCode',p.project_code,'reason','迁移既有S3项目，等待真实模拟核价回传'),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM sales_projects p
WHERE p.stage='S3' AND NOT EXISTS (SELECT 1 FROM external_tasks t WHERE t.project_id=p.id AND t.task_type='COSTING_COLLABORATION');

INSERT INTO `integration_outbox` (`id`,`project_id`,`event_id`,`event_type`,`target_system`,`external_task_id`,`payload`,`status`,`attempts`,`created_at`,`updated_at`)
SELECT 'MIG-S3-OUT-' || p.id,p.id,'MIG-S3-EVT-' || p.id,'CostingCollaborationRequested','COSTING_COLLABORATION_SIMULATOR','COST-' || substr(p.project_code,-6) || '-01',json_object('projectCode',p.project_code,'assigneeName','刘工','simulated',1),'pending',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM sales_projects p
WHERE p.stage='S3' AND EXISTS (SELECT 1 FROM external_tasks t WHERE t.id='MIG-S3-TASK-' || p.id)
  AND NOT EXISTS (SELECT 1 FROM integration_outbox o WHERE o.event_id='MIG-S3-EVT-' || p.id);
