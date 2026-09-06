CREATE TABLE `bid_preparation_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `version` integer NOT NULL,
  `scenario_code` text NOT NULL,
  `source_type` text NOT NULL,
  `source_ref` text NOT NULL,
  `source_version` text NOT NULL,
  `source_hash` text,
  `bid_round_id` text,
  `technical_requirements` text NOT NULL,
  `commercial_requirements` text NOT NULL,
  `evaluation_criteria` text NOT NULL,
  `qualification_requirements` text NOT NULL,
  `identified_risks` text NOT NULL,
  `bid_strategy` text NOT NULL,
  `work_plan` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `source_system` text DEFAULT 'BID_COLLABORATION_SIMULATOR' NOT NULL,
  `status` text DEFAULT 'effective' NOT NULL,
  `prepared_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`bid_round_id`) REFERENCES `bid_rounds`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`prepared_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `bid_preparation_source_type_ck` CHECK (`source_type` in ('TenderRequest','EPCInquiry','DirectRFQ')),
  CONSTRAINT `bid_preparation_status_ck` CHECK (`status` in ('effective','superseded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_preparation_project_version_uq` ON `bid_preparation_versions` (`project_id`,`version`);
--> statement-breakpoint
CREATE INDEX `bid_preparation_project_status_idx` ON `bid_preparation_versions` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `commercial_solution_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `version` integer NOT NULL,
  `bid_preparation_version_id` text NOT NULL,
  `payment_terms` text NOT NULL,
  `delivery_terms` text NOT NULL,
  `guarantee_terms` text NOT NULL,
  `breach_liability` text NOT NULL,
  `pricing_strategy` text NOT NULL,
  `quotation_list_ref` text NOT NULL,
  `commercial_deviations` text NOT NULL,
  `risk_assessment` text NOT NULL,
  `mitigation_plan` text NOT NULL,
  `costing_status` text DEFAULT 'pending_costing' NOT NULL,
  `evidence_ref` text NOT NULL,
  `source_system` text DEFAULT 'BID_COLLABORATION_SIMULATOR' NOT NULL,
  `status` text DEFAULT 'effective' NOT NULL,
  `prepared_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`bid_preparation_version_id`) REFERENCES `bid_preparation_versions`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`prepared_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `commercial_solution_costing_status_ck` CHECK (`costing_status` in ('pending_costing','costing_confirmed')),
  CONSTRAINT `commercial_solution_status_ck` CHECK (`status` in ('effective','superseded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commercial_solution_project_version_uq` ON `commercial_solution_versions` (`project_id`,`version`);
--> statement-breakpoint
CREATE INDEX `commercial_solution_project_status_idx` ON `commercial_solution_versions` (`project_id`,`status`);
--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-commercial','commercial','商务经理');
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('commercial-manager-tang','唐商务');
--> statement-breakpoint
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('commercial-manager-tang','role-commercial');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_tasks` (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`)
SELECT 'MIG39-TASK-' || p.id,p.id,'BID_PREPARATION','BID_COLLABORATION_SIMULATOR','BIDPREP-' || substr(p.project_code,-6) || '-M39','bid-specialist-sun','孙投标','pending','demo',1,
  json_object('projectCode',p.project_code,'scenarioCode',i.scenario_code,'sourceType',i.intent_type,'sourceRef',COALESCE(json_extract(p.detail_snapshot,'$.requestRef'),json_extract(i.source_snapshot,'$.requestRef'),json_extract(i.source_snapshot,'$.tenderNo')),'bidDeadline',p.bid_date,'correlationKey','BACKFILL-0039','environment','demo','simulated',json('true'))
FROM `sales_projects` p JOIN `procurement_intents` i ON i.id=p.procurement_intent_id
WHERE p.stage IN ('S1','S2') AND NOT EXISTS (SELECT 1 FROM external_tasks t WHERE t.project_id=p.id AND t.task_type='BID_PREPARATION');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_activity_projections` (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`environment`,`simulated`,`source_updated_at`)
SELECT 'MIG39-ACT-' || p.id,p.id,d.id,'BID_COLLABORATION_SIMULATOR','BIDPREP-' || substr(p.project_code,-6) || '-M39','bid-specialist-sun','孙投标','pending',json_array(json_object('objectType','ExternalTask','objectId','BIDPREP-' || substr(p.project_code,-6) || '-M39')),json_array(),'demo',1,CURRENT_TIMESTAMP
FROM `sales_projects` p JOIN `activity_definitions` d ON d.code='ACT-BID-02' AND d.active=1
WHERE p.stage IN ('S1','S2') AND EXISTS (SELECT 1 FROM external_tasks t WHERE t.project_id=p.id AND t.task_type='BID_PREPARATION' AND t.external_task_id='BIDPREP-' || substr(p.project_code,-6) || '-M39');
