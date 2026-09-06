-- Retire the former "sales submits to technical author for a second approval" flow.
UPDATE `stage_gate_instances`
SET `status` = 'returned',
    `decision_comment` = '流程升级：技术专业确认已归并到技术协同回传，请由销售Owner重新触发G3系统校验。',
    `decided_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `gate_code` = 'G3' AND `status` = 'pending';

UPDATE `external_tasks`
SET `status` = 'cancelled',
    `result_payload` = '{"reason":"G3_SELF_REVIEW_FLOW_RETIRED"}',
    `completed_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `task_type` = 'G3_GATE_REVIEW' AND `status` = 'pending';

-- Nuclear pricing data and authority are not ready. Preserve the task records,
-- but stop presenting a hard-coded simulated person as an onboarded owner.
UPDATE `external_tasks`
SET `status` = 'cancelled',
    `result_payload` = '{"reason":"COSTING_CAPABILITY_NOT_CONFIRMED"}',
    `completed_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `task_type` = 'COSTING_COLLABORATION' AND `status` = 'pending' AND `simulated` = 1;

UPDATE `integration_outbox`
SET `status` = 'failed',
    `last_error` = 'Flow retired: G3 self-review or unconfirmed costing capability',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `status` = 'pending'
  AND `external_task_id` IN (
    SELECT `external_task_id`
    FROM `external_tasks`
    WHERE `status` = 'cancelled'
      AND `task_type` IN ('G3_GATE_REVIEW','COSTING_COLLABORATION')
  );
