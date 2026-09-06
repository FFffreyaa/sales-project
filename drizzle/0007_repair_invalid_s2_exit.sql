-- 工作流系统身份仅用于记录自动一致性修复，不代表任何人工审批人。
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES ('role-workflow-system','workflow-system','工作流系统');
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES ('system-workflow','工作流系统');
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES ('system-workflow','role-workflow-system');

-- 旧规则曾允许硬条件未齐套的S2出口快照进入pending；先留下系统审计，再撤销异常任务。
INSERT OR IGNORE INTO `audit_records` (`id`,`project_id`,`category`,`action`,`before_state`,`after_state`,`actor_user_id`)
SELECT 'MIG7-AUDIT-' || r.id,r.project_id,'S2阶段出口','系统撤销异常冻结快照',
  json_object('reviewId',r.id,'status',r.status,'version',r.version),
  json_object('reviewId',r.id,'status','returned','reason','旧规则允许硬条件未齐套时提交；工作流系统撤销异常快照'),
  'system-workflow'
FROM stage_exit_reviews r
WHERE r.source_stage='S2' AND r.status='pending'
  AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot,'$.items')) item
    WHERE json_extract(item.value,'$.hard')=1 AND COALESCE(json_extract(item.value,'$.ready'),0)<>1);

INSERT OR IGNORE INTO `domain_events` (`id`,`aggregate_type`,`aggregate_id`,`event_type`,`payload`,`actor_user_id`)
SELECT 'MIG7-EVENT-' || r.id,'StageExitReview',r.id,'S2StageExitSnapshotInvalidated',
  json_object('reviewId',r.id,'reason','hard_blockers_in_frozen_snapshot','migration','0007'),
  'system-workflow'
FROM stage_exit_reviews r
WHERE r.source_stage='S2' AND r.status='pending'
  AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot,'$.items')) item
    WHERE json_extract(item.value,'$.hard')=1 AND COALESCE(json_extract(item.value,'$.ready'),0)<>1);

UPDATE `external_tasks`
SET status='cancelled',result_payload=json_object('reason','工作流系统撤销包含硬阻断的异常S2快照','migration','0007'),completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
WHERE task_type='S2_EXIT_REVIEW' AND status='pending' AND project_id IN (
  SELECT r.project_id FROM stage_exit_reviews r
  WHERE r.source_stage='S2' AND r.status='pending'
    AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot,'$.items')) item
      WHERE json_extract(item.value,'$.hard')=1 AND COALESCE(json_extract(item.value,'$.ready'),0)<>1)
);

UPDATE `integration_outbox`
SET status='delivered',delivered_at=CURRENT_TIMESTAMP,last_error='对应异常S2出口任务已由工作流系统撤销',updated_at=CURRENT_TIMESTAMP
WHERE status='pending' AND external_task_id IN (SELECT external_task_id FROM external_tasks WHERE task_type='S2_EXIT_REVIEW' AND status='cancelled');

UPDATE `stage_exit_reviews`
SET status='returned',review_comment='工作流系统：旧规则生成的快照包含硬阻断，已撤销；请更新来源版本，齐套后重新提交。',reviewed_by=NULL,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
WHERE source_stage='S2' AND status='pending'
  AND EXISTS (SELECT 1 FROM json_each(json_extract(snapshot,'$.items')) item
    WHERE json_extract(item.value,'$.hard')=1 AND COALESCE(json_extract(item.value,'$.ready'),0)<>1);
