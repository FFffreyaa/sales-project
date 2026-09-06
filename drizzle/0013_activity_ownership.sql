CREATE TABLE `activity_definitions` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `parent_code` text,
  `track_type` text NOT NULL CHECK (`track_type` IN ('SALES_PROJECT_MANAGEMENT','BID_OPERATION')),
  `name` text NOT NULL,
  `ltc_node_code` text,
  `authority_system` text NOT NULL,
  `completion_event` text NOT NULL,
  `executable` integer DEFAULT 1 NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `metadata` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `activity_definitions_code_version_uq` ON `activity_definitions` (`code`,`version`);
CREATE INDEX `activity_definitions_track_idx` ON `activity_definitions` (`track_type`,`active`);
--> statement-breakpoint
CREATE TABLE `activity_instances` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `definition_id` text NOT NULL REFERENCES `activity_definitions`(`id`),
  `title` text NOT NULL,
  `purpose` text NOT NULL,
  `owner_user_id` text NOT NULL REFERENCES `users`(`id`),
  `owner_name` text NOT NULL,
  `status` text DEFAULT 'planned' NOT NULL CHECK (`status` IN ('planned','in_progress','blocked','completed','cancelled')),
  `timeliness_status` text DEFAULT 'on_track' NOT NULL CHECK (`timeliness_status` IN ('on_track','due_soon','overdue','completed_late')),
  `planned_start` text,
  `planned_end` text NOT NULL,
  `actual_start` text,
  `actual_end` text,
  `result` text,
  `exception_reason` text,
  `business_object_refs` text NOT NULL,
  `gate_instance_id` text REFERENCES `stage_gate_instances`(`id`),
  `version` integer DEFAULT 1 NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `activity_instances_project_idx` ON `activity_instances` (`project_id`,`status`,`planned_end`);
CREATE INDEX `activity_instances_definition_idx` ON `activity_instances` (`definition_id`,`status`);
--> statement-breakpoint
CREATE TABLE `activity_evidence_refs` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_instance_id` text NOT NULL REFERENCES `activity_instances`(`id`),
  `evidence_type` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `activity_evidence_refs_activity_idx` ON `activity_evidence_refs` (`activity_instance_id`);
--> statement-breakpoint
CREATE TABLE `activity_transitions` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_instance_id` text NOT NULL REFERENCES `activity_instances`(`id`),
  `from_status` text,
  `to_status` text NOT NULL,
  `reason` text NOT NULL,
  `domain_event_id` text REFERENCES `domain_events`(`id`),
  `actor_user_id` text NOT NULL REFERENCES `users`(`id`),
  `occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `activity_transitions_activity_idx` ON `activity_transitions` (`activity_instance_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE `external_activity_projections` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `definition_id` text NOT NULL REFERENCES `activity_definitions`(`id`),
  `source_system` text NOT NULL,
  `external_activity_instance_id` text NOT NULL,
  `owner_external_id` text NOT NULL,
  `owner_name` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('pending','accepted','in_progress','blocked','completed','returned','rejected','cancelled')),
  `planned_start` text,
  `planned_end` text,
  `actual_start` text,
  `actual_end` text,
  `business_object_refs` text NOT NULL,
  `evidence_refs` text NOT NULL,
  `blocker` text,
  `completion_event` text,
  `source_event_id` text,
  `environment` text NOT NULL,
  `simulated` integer NOT NULL,
  `source_updated_at` text NOT NULL,
  `synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `external_activity_projections_source_uq` ON `external_activity_projections` (`source_system`,`external_activity_instance_id`);
CREATE INDEX `external_activity_projections_project_idx` ON `external_activity_projections` (`project_id`,`status`);
--> statement-breakpoint
INSERT INTO `activity_definitions` (`id`,`code`,`version`,`parent_code`,`track_type`,`name`,`ltc_node_code`,`authority_system`,`completion_event`,`executable`,`active`,`metadata`) VALUES
('ACT-BID-01@1','ACT-BID-01',1,NULL,'BID_OPERATION','销售项目立项','L2.1','BID_OPERATION_APP','SalesProjectCreated',1,1,'{}'),
('ACT-BID-02@1','ACT-BID-02',1,NULL,'BID_OPERATION','投标准备','L2.2','BID_OPERATION_APP','BidPreparationCompleted',1,1,'{}'),
('ACT-BID-03@1','ACT-BID-03',1,NULL,'BID_OPERATION','商务方案编制','L2.3','BID_OPERATION_APP','CommercialSolutionCompleted',1,1,'{}'),
('ACT-BID-04@1','ACT-BID-04',1,NULL,'BID_OPERATION','技术方案与核价','L2.4','BID_OPERATION_APP','TechnicalPricingBaselineApproved',0,1,'{"abstract":true}'),
('ACT-BID-04A@1','ACT-BID-04A',1,'ACT-BID-04','BID_OPERATION','标书解读与需求基线','L2.4.1','TECHNICAL_SYSTEM','RequirementBaselineConfirmed',1,1,'{}'),
('ACT-BID-04B@1','ACT-BID-04B',1,'ACT-BID-04','BID_OPERATION','技术方案与设计BOM','L2.4.2','TECHNICAL_SYSTEM','TechnicalSolutionApproved',1,1,'{}'),
('ACT-BID-04C@1','ACT-BID-04C',1,'ACT-BID-04','BID_OPERATION','方案核价与价格授权','L2.4.3','COSTING_SYSTEM','PricingAuthorizationApproved',1,1,'{}'),
('ACT-BID-05@1','ACT-BID-05',1,NULL,'BID_OPERATION','投标文件形成','L2.5','BID_OPERATION_APP','BidPackagePrepared',1,1,'{}'),
('ACT-BID-06@1','ACT-BID-06',1,NULL,'BID_OPERATION','投标评审','L2.6','BID_OPERATION_APP','BidReviewCompleted',1,1,'{}'),
('ACT-BID-07@1','ACT-BID-07',1,NULL,'BID_OPERATION','投标决策','L2.7','BID_OPERATION_APP','BidDecisionMade',1,1,'{}'),
('ACT-BID-08@1','ACT-BID-08',1,NULL,'BID_OPERATION','正式提交','L2.8','BID_OPERATION_APP','CommercialSubmissionAccepted',1,1,'{}'),
('ACT-BID-09@1','ACT-BID-09',1,NULL,'BID_OPERATION','投标结果','L2.9','BID_OPERATION_APP','SalesProjectResultConfirmed',1,1,'{"responsibilityEnd":"BID_OPERATION_ONLY"}'),
('ACT-SPM-01@1','ACT-SPM-01',1,NULL,'SALES_PROJECT_MANAGEMENT','项目价值、等级与Owner','L2.1','SALES_PROJECT_APP','SalesProjectPriorityConfirmed',1,1,'{}'),
('ACT-SPM-02@1','ACT-SPM-02',1,NULL,'SALES_PROJECT_MANAGEMENT','项目策略管理',NULL,'SALES_PROJECT_APP','ProjectStrategyApproved',1,1,'{}'),
('ACT-SPM-03@1','ACT-SPM-03',1,NULL,'SALES_PROJECT_MANAGEMENT','客户关系与决策链覆盖',NULL,'SALES_PROJECT_APP','CustomerRelationshipRefreshed',1,1,'{}'),
('ACT-SPM-04@1','ACT-SPM-04',1,NULL,'SALES_PROJECT_MANAGEMENT','关键资源到位',NULL,'SALES_PROJECT_APP','CriticalResourcesConfirmed',1,1,'{}'),
('ACT-SPM-05@1','ACT-SPM-05',1,NULL,'SALES_PROJECT_MANAGEMENT','项目运作与伙伴协同',NULL,'SALES_PROJECT_APP','ProjectActionCompleted',1,1,'{}'),
('ACT-SPM-06@1','ACT-SPM-06',1,NULL,'SALES_PROJECT_MANAGEMENT','阶段评估与风险处置',NULL,'SALES_PROJECT_APP','SalesProjectRiskEvaluated',1,1,'{}'),
('ACT-SPM-07@1','ACT-SPM-07',1,NULL,'SALES_PROJECT_MANAGEMENT','结果衔接与复盘','L2.9','SALES_PROJECT_APP','SalesProjectResultHandled',1,1,'{}'),
('ACT-SPM-08@1','ACT-SPM-08',1,NULL,'SALES_PROJECT_MANAGEMENT','成交后经营跟踪','L2.9+','SALES_PROJECT_APP','SalesProjectDownstreamRefreshed',1,1,'{"retainedAfterAward":true}');
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG-SPM01-' || p.id,p.id,'ACT-SPM-01@1','确认项目价值、等级与Owner','形成可审计的项目优先级和Owner责任',p.owner_user_id,p.owner_name,
  CASE WHEN p.stage='S0' THEN 'in_progress' ELSE 'completed' END,'on_track',substr(p.created_at,1,10),p.bid_date,
  CASE WHEN p.stage='S0' THEN NULL ELSE p.updated_at END,CASE WHEN p.stage='S0' THEN NULL ELSE '历史项目已完成立项并纳管' END,
  json_array(json_object('objectType','SalesProject','objectId',p.id),json_object('objectType','ProcurementIntent','objectId',p.procurement_intent_id)),p.owner_user_id
FROM sales_projects p;
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`business_object_refs`,`created_by`)
SELECT 'MIG-SPM05-' || p.id,p.id,'ACT-SPM-05@1',COALESCE(json_extract(p.detail_snapshot,'$.firstAction'),'确认客户采购事实'),'完成立项后的首个客户经营事实确认',p.owner_user_id,p.owner_name,
  'planned','on_track',COALESCE(json_extract(p.detail_snapshot,'$.requirementDate'),substr(p.created_at,1,10)),COALESCE(json_extract(p.detail_snapshot,'$.requirementDate'),p.bid_date),json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p;
--> statement-breakpoint
INSERT INTO `activity_evidence_refs` (`id`,`activity_instance_id`,`evidence_type`,`evidence_ref`,`created_by`)
SELECT 'MIG-EVI-' || p.id,'MIG-SPM01-' || p.id,'INPUT',p.evidence,p.owner_user_id FROM sales_projects p;
--> statement-breakpoint
INSERT INTO `activity_transitions` (`id`,`activity_instance_id`,`from_status`,`to_status`,`reason`,`actor_user_id`)
SELECT 'MIG-TRN-SPM01-' || p.id,'MIG-SPM01-' || p.id,NULL,CASE WHEN p.stage='S0' THEN 'in_progress' ELSE 'completed' END,'0013迁移现有销售项目活动语义',p.owner_user_id FROM sales_projects p;
INSERT INTO `activity_transitions` (`id`,`activity_instance_id`,`from_status`,`to_status`,`reason`,`actor_user_id`)
SELECT 'MIG-TRN-SPM05-' || p.id,'MIG-SPM05-' || p.id,NULL,'planned','0013迁移现有首个销售行动',p.owner_user_id FROM sales_projects p;
--> statement-breakpoint
INSERT INTO `external_activity_projections` (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`completion_event`,`environment`,`simulated`,`source_updated_at`)
SELECT 'MIG-EXT-' || t.id,t.project_id,d.id,t.target_system,t.external_task_id,t.assignee_external_id,t.assignee_name,t.status,
  json_array(json_object('objectType','ExternalTask','objectId',t.external_task_id)),'[]',
  CASE WHEN t.status='completed' THEN
    CASE t.task_type WHEN 'TECHNICAL_COLLABORATION' THEN 'TechnicalSolutionApproved' WHEN 'COSTING_COLLABORATION' THEN 'PricingAuthorizationApproved' WHEN 'BID_PACKAGE_PREPARATION' THEN 'BidPackagePrepared' WHEN 'G5_SUBMISSION_EXECUTION' THEN 'CommercialSubmissionAccepted' WHEN 'COMMERCIAL_RESULT_TRACKING' THEN 'SalesProjectResultConfirmed' END
  ELSE NULL END,'demo',1,t.updated_at
FROM external_tasks t
JOIN activity_definitions d ON d.code=CASE t.task_type WHEN 'TECHNICAL_COLLABORATION' THEN 'ACT-BID-04B' WHEN 'COSTING_COLLABORATION' THEN 'ACT-BID-04C' WHEN 'BID_PACKAGE_PREPARATION' THEN 'ACT-BID-05' WHEN 'G5_SUBMISSION_EXECUTION' THEN 'ACT-BID-08' WHEN 'COMMERCIAL_RESULT_TRACKING' THEN 'ACT-BID-09' END
WHERE t.task_type IN ('TECHNICAL_COLLABORATION','COSTING_COLLABORATION','BID_PACKAGE_PREPARATION','G5_SUBMISSION_EXECUTION','COMMERCIAL_RESULT_TRACKING');
