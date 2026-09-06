UPDATE `external_tasks`
SET `status`='cancelled',`updated_at`=CURRENT_TIMESTAMP
WHERE `task_type`='COMMERCIAL_RESULT_TRACKING'
  AND `status` IN ('pending','accepted')
  AND json_extract(`request_payload`,'$.routeId') IS NULL;
--> statement-breakpoint
UPDATE `external_activity_projections`
SET `status`='cancelled',`updated_at`=CURRENT_TIMESTAMP
WHERE `source_system`='BID_COLLABORATION_SIMULATOR'
  AND `status` IN ('pending','accepted','in_progress')
  AND `definition_id` IN (SELECT `id` FROM `activity_definitions` WHERE `code`='ACT-BID-09');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_tasks`
  (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`)
SELECT
  'MIG20-RESULT-' || s.`id`,s.`project_id`,'COMMERCIAL_RESULT_TRACKING','BID_COLLABORATION_SIMULATOR',
  'RESULT-' || substr(p.`project_code`,-6) || '-' || upper(substr(replace(s.`route_id`,'-',''),-6)),
  'bid-specialist-sun','孙投标','pending','demo',1,
  json_object('gateId',s.`gate_instance_id`,'gateVersion',s.`gate_version`,'routeId',s.`route_id`,'commercialSubmissionId',s.`id`,'bidPackageVersionId',s.`bid_package_version_id`,'submissionReceiptRef',s.`receipt_ref`,'correlationKey',s.`route_id`,'projectCode',p.`project_code`,'environment','demo','simulated',json('true'))
FROM `commercial_submissions` s JOIN `sales_projects` p ON p.`id`=s.`project_id`
WHERE p.`stage`='S5' AND p.`result`='pending' AND s.`status`='accepted'
  AND NOT EXISTS (
    SELECT 1 FROM `external_tasks` t
    WHERE t.`project_id`=s.`project_id` AND t.`task_type`='COMMERCIAL_RESULT_TRACKING'
      AND t.`status` IN ('pending','accepted','completed')
      AND json_extract(t.`request_payload`,'$.routeId')=s.`route_id`
  );
--> statement-breakpoint
INSERT OR IGNORE INTO `external_activity_projections`
  (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`environment`,`simulated`,`source_updated_at`)
SELECT
  'MIG20-ACT-' || t.`id`,t.`project_id`,d.`id`,'BID_COLLABORATION_SIMULATOR',t.`external_task_id`,
  t.`assignee_external_id`,t.`assignee_name`,t.`status`,
  json_array(json_object('objectType','ExternalTask','objectId',t.`external_task_id`),json_object('objectType','ActivityDefinition','objectId','ACT-BID-09'),json_object('objectType','QuotationRoute','objectId',json_extract(t.`request_payload`,'$.routeId'))),
  json_array(),'demo',1,CURRENT_TIMESTAMP
FROM `external_tasks` t JOIN `activity_definitions` d ON d.`code`='ACT-BID-09' AND d.`active`=1
WHERE t.`task_type`='COMMERCIAL_RESULT_TRACKING' AND t.`status`='pending'
  AND json_extract(t.`request_payload`,'$.routeId') IS NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
