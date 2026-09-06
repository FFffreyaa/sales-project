CREATE TABLE `parties` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `normalized_name` text NOT NULL,
  `party_kind` text NOT NULL CHECK (`party_kind` IN ('customer','epc_customer')),
  `master_status` text DEFAULT 'temporary' NOT NULL CHECK (`master_status` IN ('temporary','matched','verified')),
  `source_system` text NOT NULL,
  `source_ref` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `parties_normalized_name_uq` ON `parties` (`normalized_name`);
CREATE UNIQUE INDEX `parties_source_uq` ON `parties` (`source_system`,`source_ref`);
--> statement-breakpoint
CREATE TABLE `opportunity_fingerprints` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `fingerprint_key` text NOT NULL,
  `final_customer_name` text NOT NULL,
  `procurement_project_name` text NOT NULL,
  `tender_no` text,
  `lot_no` text,
  `delivery_location` text NOT NULL,
  `product_scope` text NOT NULL,
  `procurement_time_window` text,
  `verification_status` text DEFAULT 'confirmed' NOT NULL CHECK (`verification_status` IN ('legacy_unverified','confirmed')),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `opportunity_fingerprints_project_uq` ON `opportunity_fingerprints` (`project_id`);
CREATE UNIQUE INDEX `opportunity_fingerprints_key_uq` ON `opportunity_fingerprints` (`fingerprint_key`);
--> statement-breakpoint
CREATE TABLE `procurement_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `procurement_intent_id` text NOT NULL REFERENCES `procurement_intents`(`id`),
  `request_type` text NOT NULL CHECK (`request_type` IN ('TenderRequest','EPCInquiry','DirectRFQ')),
  `request_ref` text NOT NULL,
  `source_party_id` text NOT NULL REFERENCES `parties`(`id`),
  `final_customer_party_id` text NOT NULL REFERENCES `parties`(`id`),
  `inquiry_batch` text,
  `evidence_ref` text NOT NULL,
  `requested_submission_date` text NOT NULL,
  `status` text DEFAULT 'effective' NOT NULL CHECK (`status` IN ('effective','superseded')),
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `procurement_requests_source_uq` ON `procurement_requests` (`source_party_id`,`request_ref`);
CREATE INDEX `procurement_requests_project_idx` ON `procurement_requests` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `sales_project_party_roles` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `party_id` text NOT NULL REFERENCES `parties`(`id`),
  `role_type` text NOT NULL CHECK (`role_type` IN ('end_customer','inquiry_customer','potential_contract_customer','final_contract_customer')),
  `source_request_id` text REFERENCES `procurement_requests`(`id`),
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active','inactive')),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `sales_project_party_roles_uq` ON `sales_project_party_roles` (`project_id`,`party_id`,`role_type`);
CREATE INDEX `sales_project_party_roles_project_idx` ON `sales_project_party_roles` (`project_id`,`status`);
--> statement-breakpoint
CREATE TABLE `partner_need_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `decision` text NOT NULL CHECK (`decision` IN ('needed','not_needed')),
  `reason` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `decided_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `partner_need_decisions_project_uq` ON `partner_need_decisions` (`project_id`);
--> statement-breakpoint
CREATE TABLE `partner_engagements` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `partner_name` text NOT NULL,
  `partner_type` text NOT NULL,
  `need_status` text NOT NULL CHECK (`need_status` IN ('needed','not_needed')),
  `verification_status` text DEFAULT 'candidate' NOT NULL CHECK (`verification_status` IN ('candidate','verification_pending','verified','rejected')),
  `verification_evidence_ref` text NOT NULL,
  `verification_decision_evidence_ref` text,
  `verification_comment` text,
  `verified_by` text REFERENCES `users`(`id`),
  `verified_at` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `partner_engagements_project_name_uq` ON `partner_engagements` (`project_id`,`partner_name`);
CREATE INDEX `partner_engagements_project_status_idx` ON `partner_engagements` (`project_id`,`verification_status`);
--> statement-breakpoint
CREATE TABLE `partner_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `partner_engagement_id` text NOT NULL REFERENCES `partner_engagements`(`id`),
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `contribution_type` text NOT NULL,
  `result` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `occurred_at` text NOT NULL,
  `recorded_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `partner_contributions_project_idx` ON `partner_contributions` (`project_id`,`occurred_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `parties` (`id`,`display_name`,`normalized_name`,`party_kind`,`master_status`,`source_system`,`source_ref`)
-- 历史数据没有稳定的客户主数据编号；暂按项目隔离，避免同名客户导致后续外键指向不存在的记录。
-- 这些记录明确标记为 temporary/legacy，后续只能通过正式客户匹配流程归并，不能静默当成同一客户。
SELECT 'LEGACY-PARTY-' || p.id,p.customer_name,lower(replace(replace(trim(p.customer_name),' ',''),'　','')) || '|legacy|' || p.id,
  CASE WHEN i.scenario_code='SCN-02-EPC-INQUIRY' THEN 'epc_customer' ELSE 'customer' END,
  'temporary','LEGACY_MIGRATION','SALES_PROJECT:' || p.project_code
FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id;
--> statement-breakpoint
INSERT OR IGNORE INTO `opportunity_fingerprints` (`id`,`project_id`,`fingerprint_key`,`final_customer_name`,`procurement_project_name`,`delivery_location`,`product_scope`,`verification_status`)
SELECT 'LEGACY-FP-' || p.id,p.id,'LEGACY:' || p.id,p.customer_name,p.name,'待核实',p.target,'legacy_unverified'
FROM sales_projects p;
--> statement-breakpoint
INSERT OR IGNORE INTO `procurement_requests` (`id`,`project_id`,`procurement_intent_id`,`request_type`,`request_ref`,`source_party_id`,`final_customer_party_id`,`evidence_ref`,`requested_submission_date`,`created_by`)
SELECT 'LEGACY-REQ-' || p.id,p.id,i.id,
  CASE i.scenario_code WHEN 'SCN-01-DIRECT-BID' THEN 'TenderRequest' WHEN 'SCN-02-EPC-INQUIRY' THEN 'EPCInquiry' ELSE 'DirectRFQ' END,
  'LEGACY:' || i.id,'LEGACY-PARTY-' || p.id,'LEGACY-PARTY-' || p.id,i.evidence,i.bid_date,i.created_by
FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id;
--> statement-breakpoint
INSERT OR IGNORE INTO `sales_project_party_roles` (`id`,`project_id`,`party_id`,`role_type`,`source_request_id`)
SELECT 'LEGACY-ROLE-' || p.id,p.id,'LEGACY-PARTY-' || p.id,
  CASE WHEN i.scenario_code='SCN-02-EPC-INQUIRY' THEN 'inquiry_customer' ELSE 'end_customer' END,
  'LEGACY-REQ-' || p.id
FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id;
--> statement-breakpoint
PRAGMA optimize;
