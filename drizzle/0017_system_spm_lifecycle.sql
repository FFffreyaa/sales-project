-- 生命周期级销售项目活动：由已入账领域事件自动创建和推进，不允许前端伪造。
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_start`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG17-SPM02-' || p.id,p.id,'ACT-SPM-02@1','形成并维护项目策略版本','围绕客户决策偏好、竞争态势和赢单目标形成可审批策略',p.owner_user_id,p.owner_name,
  CASE WHEN p.stage='S1' THEN 'in_progress' ELSE 'completed' END,'on_track',substr(p.created_at,1,10),COALESCE(json_extract(p.detail_snapshot,'$.technicalDate'),p.bid_date),
  p.created_at,CASE WHEN p.stage='S1' THEN NULL ELSE p.updated_at END,CASE WHEN p.stage='S1' THEN NULL ELSE '历史项目策略阶段已完成' END,
  json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p
WHERE p.stage<>'S0' AND NOT EXISTS (SELECT 1 FROM activity_instances a WHERE a.project_id=p.id AND a.definition_id='ACT-SPM-02@1');
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_start`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG17-SPM03-' || p.id,p.id,'ACT-SPM-03@1','覆盖客户关系与决策链','持续维护关键关系、影响力和客户决策链变化',p.owner_user_id,p.owner_name,
  CASE WHEN p.stage IN ('S1','S2','S3','S4') THEN 'in_progress' ELSE 'completed' END,'on_track',substr(p.created_at,1,10),p.bid_date,
  p.created_at,CASE WHEN p.stage IN ('S1','S2','S3','S4') THEN NULL ELSE p.updated_at END,CASE WHEN p.stage IN ('S1','S2','S3','S4') THEN NULL ELSE '历史项目已完成商务决策' END,
  json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p
WHERE p.stage<>'S0' AND NOT EXISTS (SELECT 1 FROM activity_instances a WHERE a.project_id=p.id AND a.definition_id='ACT-SPM-03@1');
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_start`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG17-SPM04-' || p.id,p.id,'ACT-SPM-04@1','确认关键责任资源到位','完成技术负责人及必要伙伴资源的指派、接受与到位确认',p.owner_user_id,p.owner_name,
  CASE WHEN p.stage='S1' THEN 'in_progress' ELSE 'completed' END,'on_track',substr(p.created_at,1,10),COALESCE(json_extract(p.detail_snapshot,'$.technicalDate'),p.bid_date),
  p.created_at,CASE WHEN p.stage='S1' THEN NULL ELSE p.updated_at END,CASE WHEN p.stage='S1' THEN NULL ELSE '历史项目责任资源已确认' END,
  json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p
WHERE p.stage<>'S0' AND NOT EXISTS (SELECT 1 FROM activity_instances a WHERE a.project_id=p.id AND a.definition_id='ACT-SPM-04@1');
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_start`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG17-SPM07-' || p.id,p.id,'ACT-SPM-07@1','跟踪商业结果并准备移交或复盘','接收正式结果事实，完成赢单基线移交或失标结构化复盘',p.owner_user_id,p.owner_name,
  CASE WHEN p.stage='S5' AND p.result='pending' THEN 'in_progress' ELSE 'completed' END,'on_track',substr(p.updated_at,1,10),date(p.bid_date,'+30 day'),
  p.updated_at,CASE WHEN p.stage='S5' AND p.result='pending' THEN NULL ELSE p.updated_at END,CASE WHEN p.stage='S5' AND p.result='pending' THEN NULL ELSE '历史项目结果已处理' END,
  json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p
WHERE p.stage IN ('S5','S6') AND NOT EXISTS (SELECT 1 FROM activity_instances a WHERE a.project_id=p.id AND a.definition_id='ACT-SPM-07@1');
--> statement-breakpoint
INSERT INTO `activity_instances` (`id`,`project_id`,`definition_id`,`title`,`purpose`,`owner_user_id`,`owner_name`,`status`,`timeliness_status`,`planned_start`,`planned_end`,`actual_start`,`actual_end`,`result`,`business_object_refs`,`created_by`)
SELECT 'MIG17-SPM08-' || p.id,p.id,'ACT-SPM-08@1','跟踪成交后合同、订单、履约、开票与回款','只读汇总下游权威状态并跟踪销售遗留责任；不在本APP修改专业事实',p.owner_user_id,p.owner_name,
  CASE WHEN p.administrative_status='Closed' THEN 'completed' ELSE 'in_progress' END,'on_track',substr(p.updated_at,1,10),date(substr(p.updated_at,1,10),'+30 day'),
  p.updated_at,CASE WHEN p.administrative_status='Closed' THEN p.updated_at ELSE NULL END,CASE WHEN p.administrative_status='Closed' THEN '历史项目经营跟踪已关闭' ELSE NULL END,
  json_array(json_object('objectType','SalesProject','objectId',p.id)),p.owner_user_id
FROM sales_projects p
WHERE p.stage='S6' AND p.result='won' AND NOT EXISTS (SELECT 1 FROM activity_instances a WHERE a.project_id=p.id AND a.definition_id='ACT-SPM-08@1');
--> statement-breakpoint
INSERT INTO `activity_transitions` (`id`,`activity_instance_id`,`from_status`,`to_status`,`reason`,`actor_user_id`)
SELECT 'MIG17-TRN-' || a.id,a.id,NULL,a.status,'0017补齐生命周期级销售项目活动',a.created_by
FROM activity_instances a
WHERE a.id LIKE 'MIG17-%' AND NOT EXISTS (SELECT 1 FROM activity_transitions t WHERE t.activity_instance_id=a.id);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_instances_project_lifecycle_uq`
ON `activity_instances` (`project_id`,`definition_id`)
WHERE `definition_id` IN ('ACT-SPM-02@1','ACT-SPM-03@1','ACT-SPM-04@1','ACT-SPM-07@1','ACT-SPM-08@1');
--> statement-breakpoint
PRAGMA optimize;
