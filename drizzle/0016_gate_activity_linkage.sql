-- 一张技术协同任务同时形成需求基线(04A)与方案/BOM(04B)。
-- 04B沿用既有外部活动ID；04A使用稳定后缀，避免破坏历史投影引用。
INSERT INTO `external_activity_projections`
  (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`completion_event`,`environment`,`simulated`,`source_updated_at`)
SELECT 'ACTPROJ-04A-' || t.id,t.project_id,d.id,t.target_system,t.external_task_id || ':ACT-BID-04A',t.assignee_external_id,t.assignee_name,t.status,
  json_array(json_object('objectType','ExternalTask','objectId',t.external_task_id),json_object('objectType','ActivityDefinition','objectId','ACT-BID-04A')),
  '[]',CASE WHEN t.status='completed' THEN d.completion_event ELSE NULL END,t.environment,t.simulated,t.updated_at
FROM external_tasks t
JOIN activity_definitions d ON d.code='ACT-BID-04A' AND d.active=1
WHERE t.task_type='TECHNICAL_COLLABORATION'
  AND NOT EXISTS (
    SELECT 1 FROM external_activity_projections p
    WHERE p.source_system=t.target_system AND p.external_activity_instance_id=t.external_task_id || ':ACT-BID-04A'
  );
--> statement-breakpoint
-- 当前测试台的一张投标包任务同时交付组包(05)与专业评审(06)。
INSERT INTO `external_activity_projections`
  (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`completion_event`,`environment`,`simulated`,`source_updated_at`)
SELECT 'ACTPROJ-06-' || t.id,t.project_id,d.id,t.target_system,t.external_task_id || ':ACT-BID-06',t.assignee_external_id,t.assignee_name,t.status,
  json_array(json_object('objectType','ExternalTask','objectId',t.external_task_id),json_object('objectType','ActivityDefinition','objectId','ACT-BID-06')),
  '[]',CASE WHEN t.status='completed' THEN d.completion_event ELSE NULL END,t.environment,t.simulated,t.updated_at
FROM external_tasks t
JOIN activity_definitions d ON d.code='ACT-BID-06' AND d.active=1
WHERE t.task_type='BID_PACKAGE_PREPARATION'
  AND NOT EXISTS (
    SELECT 1 FROM external_activity_projections p
    WHERE p.source_system=t.target_system AND p.external_activity_instance_id=t.external_task_id || ':ACT-BID-06'
  );
--> statement-breakpoint
PRAGMA optimize;
