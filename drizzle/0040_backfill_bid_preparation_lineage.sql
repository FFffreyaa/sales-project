UPDATE `external_tasks`
SET `request_payload`=json_set(
  `request_payload`,
  '$.sourceType',CASE (SELECT i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=external_tasks.project_id)
    WHEN 'SCN-01-DIRECT-BID' THEN 'TenderRequest'
    WHEN 'SCN-02-EPC-INQUIRY' THEN 'EPCInquiry'
    WHEN 'SCN-03-DIRECT-RFQ' THEN 'DirectRFQ'
    WHEN 'SCN-04-OVERSEAS-PARTNER-EPC' THEN 'EPCInquiry'
  END,
  '$.sourceRef',COALESCE(
    (SELECT b.tender_document_ref FROM bid_rounds b WHERE b.project_id=external_tasks.project_id AND b.status='active' ORDER BY b.round_no DESC LIMIT 1),
    (SELECT r.request_ref FROM procurement_requests r WHERE r.project_id=external_tasks.project_id AND r.status='effective' ORDER BY r.created_at DESC LIMIT 1)
  )
),`updated_at`=CURRENT_TIMESTAMP
WHERE `task_type`='BID_PREPARATION' AND `status` IN ('pending','accepted');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_tasks` (`id`,`project_id`,`task_type`,`target_system`,`external_task_id`,`assignee_external_id`,`assignee_name`,`status`,`environment`,`simulated`,`request_payload`)
SELECT 'MIG40-TASK-' || p.id,p.id,'BID_PREPARATION','BID_COLLABORATION_SIMULATOR','BIDPREP-' || substr(p.project_code,-6) || '-M40','bid-specialist-sun','孙投标','pending','demo',1,
  json_object('projectCode',p.project_code,'scenarioCode',i.scenario_code,'sourceType',CASE i.scenario_code WHEN 'SCN-01-DIRECT-BID' THEN 'TenderRequest' WHEN 'SCN-02-EPC-INQUIRY' THEN 'EPCInquiry' WHEN 'SCN-03-DIRECT-RFQ' THEN 'DirectRFQ' WHEN 'SCN-04-OVERSEAS-PARTNER-EPC' THEN 'EPCInquiry' END,'sourceRef',COALESCE((SELECT b.tender_document_ref FROM bid_rounds b WHERE b.project_id=p.id AND b.status='active' ORDER BY b.round_no DESC LIMIT 1),(SELECT r.request_ref FROM procurement_requests r WHERE r.project_id=p.id AND r.status='effective' ORDER BY r.created_at DESC LIMIT 1)),'bidDeadline',p.bid_date,'correlationKey','BACKFILL-0040','environment','demo','simulated',json('true'))
FROM `sales_projects` p JOIN `procurement_intents` i ON i.id=p.procurement_intent_id
WHERE p.stage IN ('S1','S2') AND NOT EXISTS (SELECT 1 FROM external_tasks t WHERE t.project_id=p.id AND t.task_type='BID_PREPARATION');
--> statement-breakpoint
INSERT OR IGNORE INTO `external_activity_projections` (`id`,`project_id`,`definition_id`,`source_system`,`external_activity_instance_id`,`owner_external_id`,`owner_name`,`status`,`business_object_refs`,`evidence_refs`,`environment`,`simulated`,`source_updated_at`)
SELECT 'MIG40-ACT-' || t.id,t.project_id,d.id,t.target_system,t.external_task_id,t.assignee_external_id,t.assignee_name,t.status,json_array(json_object('objectType','ExternalTask','objectId',t.external_task_id)),json_array(),'demo',1,CURRENT_TIMESTAMP
FROM `external_tasks` t JOIN `activity_definitions` d ON d.code='ACT-BID-02' AND d.active=1
WHERE t.task_type='BID_PREPARATION' AND NOT EXISTS (SELECT 1 FROM external_activity_projections a WHERE a.source_system=t.target_system AND a.external_activity_instance_id=t.external_task_id);
--> statement-breakpoint
INSERT OR IGNORE INTO `integration_outbox` (`id`,`project_id`,`event_id`,`event_type`,`target_system`,`external_task_id`,`payload`,`status`,`attempts`)
SELECT 'MIG40-OUT-' || t.id,t.project_id,'MIG40-EVT-' || t.id,'BidPreparationRequested',t.target_system,t.external_task_id,
  json_object('eventId','MIG40-EVT-' || t.id,'eventType','BidPreparationRequested','sourceSystem','SALES_PROJECT_APP','targetSystem',t.target_system,'projectCode',p.project_code,'externalTaskId',t.external_task_id,'assigneeExternalId',t.assignee_external_id,'assigneeName',t.assignee_name,'environment','demo','simulated',json('true'),'data',json(t.request_payload)),
  'pending',0
FROM external_tasks t JOIN sales_projects p ON p.id=t.project_id
WHERE t.task_type='BID_PREPARATION' AND NOT EXISTS (SELECT 1 FROM integration_outbox o WHERE o.external_task_id=t.external_task_id AND o.event_type='BidPreparationRequested');
