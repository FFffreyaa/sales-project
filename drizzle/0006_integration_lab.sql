CREATE TABLE `external_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`task_type` text NOT NULL,
	`target_system` text NOT NULL,
	`external_task_id` text NOT NULL,
	`assignee_external_id` text NOT NULL,
	`assignee_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` in ('pending','accepted','completed','returned','rejected','cancelled')),
	`environment` text DEFAULT 'demo' NOT NULL,
	`simulated` integer DEFAULT true NOT NULL,
	`request_payload` text NOT NULL,
	`result_payload` text,
	`accepted_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `external_tasks_external_id_uq` ON `external_tasks` (`external_task_id`);
CREATE INDEX `external_tasks_project_status_idx` ON `external_tasks` (`project_id`,`status`);

CREATE TABLE `integration_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`target_system` text NOT NULL,
	`external_task_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` in ('pending','delivered','failed')),
	`attempts` integer DEFAULT 0 NOT NULL,
	`delivered_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `integration_outbox_event_id_uq` ON `integration_outbox` (`event_id`);
CREATE INDEX `integration_outbox_status_idx` ON `integration_outbox` (`status`,`created_at`);

CREATE TABLE `integration_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`source_system` text NOT NULL,
	`event_type` text NOT NULL,
	`project_code` text NOT NULL,
	`external_task_id` text NOT NULL,
	`environment` text NOT NULL,
	`simulated` integer NOT NULL,
	`actor_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload` text NOT NULL,
	`processing_status` text DEFAULT 'received' NOT NULL CHECK (`processing_status` in ('received','processed','rejected','duplicate')),
	`processing_error` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text
);
CREATE UNIQUE INDEX `integration_inbox_event_id_uq` ON `integration_inbox` (`event_id`);
CREATE INDEX `integration_inbox_project_idx` ON `integration_inbox` (`project_code`,`received_at`);

CREATE TABLE `integration_event_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`inbox_id` text NOT NULL REFERENCES `integration_inbox`(`id`),
	`action` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `integration_event_logs_inbox_idx` ON `integration_event_logs` (`inbox_id`,`created_at`);

-- 已经配置但尚未接受的技术负责人，迁移为独立外部协同任务；不改变原有角色状态。
INSERT INTO `external_tasks` (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`,`created_at`,`updated_at`)
SELECT 'MIG-TASK-' || r.id,r.project_id,'TECHNICAL_COLLABORATION','TECHNICAL_COLLABORATION_SIMULATOR','TECH-' || substr(p.project_code,-6) || '-01','technical-zhao',r.assignee_name,'pending','demo',1,json_object('projectCode',p.project_code,'roleName',r.role_name,'reason','迁移既有待接受技术指派'),r.created_at,CURRENT_TIMESTAMP
FROM role_assignments r JOIN sales_projects p ON p.id=r.project_id
WHERE r.role_name='技术负责人' AND r.assignee_name='赵工' AND r.status='待接受';

INSERT INTO `integration_outbox` (`id`,`project_id`,`event_id`,`event_type`,`target_system`,`external_task_id`,`payload`,`status`,`attempts`,`created_at`,`updated_at`)
SELECT 'MIG-OUT-' || r.id,r.project_id,'MIG-EVT-' || r.id,'TechnicalCollaborationRequested','TECHNICAL_COLLABORATION_SIMULATOR','TECH-' || substr(p.project_code,-6) || '-01',json_object('projectCode',p.project_code,'assigneeName',r.assignee_name,'simulated',1),'pending',0,r.created_at,CURRENT_TIMESTAMP
FROM role_assignments r JOIN sales_projects p ON p.id=r.project_id
WHERE r.role_name='技术负责人' AND r.assignee_name='赵工' AND r.status='待接受';
