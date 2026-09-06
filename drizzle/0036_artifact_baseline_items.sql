CREATE TABLE `artifact_baseline_items` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `field_code` text NOT NULL,
  `field_label` text NOT NULL,
  `artifact_kind` text NOT NULL,
  `artifact_version_id` text NOT NULL,
  `value_text` text NOT NULL,
  `unit` text,
  `applicability` text NOT NULL DEFAULT 'applicable',
  `source_system` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `simulated` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'effective',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `artifact_baseline_items_kind_ck` CHECK (`artifact_kind` in ('requirement','solution_bom','costing_pricing','bid_submission')),
  CONSTRAINT `artifact_baseline_items_applicability_ck` CHECK (`applicability` in ('applicable','not_applicable','unknown')),
  CONSTRAINT `artifact_baseline_items_status_ck` CHECK (`status` in ('effective','superseded'))
);
CREATE UNIQUE INDEX `artifact_baseline_items_version_field_uq` ON `artifact_baseline_items` (`artifact_kind`,`artifact_version_id`,`field_code`);
CREATE INDEX `artifact_baseline_items_project_idx` ON `artifact_baseline_items` (`project_id`,`status`,`field_code`);

-- 公司线索原型中的500kV样本事实；只回填有明确来源的字段，未提供项继续保留缺口。
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`unit`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-REQ-QTY',p.id,'quantity','数量','requirement',r.id,'1','台','LEAD_PROTOTYPE_SAMPLE','线索管理系统-完整版｜500kV超高压变压器检修',1 FROM sales_projects p JOIN customer_requirement_versions r ON r.project_id=p.id AND r.status IN ('effective','approved') WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY r.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-REQ-PARAM',p.id,'key_parameter','关键参数','requirement',r.id,'电压等级500kV；绝缘油25号','LEAD_PROTOTYPE_SAMPLE','线索管理系统-完整版｜产品字段',1 FROM sales_projects p JOIN customer_requirement_versions r ON r.project_id=p.id AND r.status IN ('effective','approved') WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY r.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-REQ-SCOPE',p.id,'supply_scope','供货范围','requirement',r.id,'500kV变压器大修服务：绕组更换、铁芯叠装、套管更换、绝缘油处理及色谱分析','LEAD_PROTOTYPE_SAMPLE','线索管理系统-完整版｜scope/overview',1 FROM sales_projects p JOIN customer_requirement_versions r ON r.project_id=p.id AND r.status IN ('effective','approved') WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY r.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`unit`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-REQ-DUE',p.id,'delivery_time','交期','requirement',r.id,'30','天','LEAD_PROTOTYPE_SAMPLE','线索管理系统-完整版｜overview',1 FROM sales_projects p JOIN customer_requirement_versions r ON r.project_id=p.id AND r.status IN ('effective','approved') WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY r.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`applicability`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-REQ-LOC',p.id,'delivery_location','交付地点','requirement',r.id,'西北区域（具体交付地点未提供）','unknown','LEAD_PROTOTYPE_SAMPLE','线索管理系统-完整版｜region',1 FROM sales_projects p JOIN customer_requirement_versions r ON r.project_id=p.id AND r.status IN ('effective','approved') WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY r.version DESC LIMIT 1;

INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`unit`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-BOM-QTY',p.id,'quantity','数量','solution_bom',b.id,'1','台','TECHNICAL_COLLABORATION_SIMULATOR',b.evidence_ref,1 FROM sales_projects p JOIN quotation_design_bom_versions b ON b.project_id=p.id AND b.status='approved' WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY b.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-BOM-PARAM',p.id,'key_parameter','关键参数','solution_bom',b.id,'电压等级500kV；绝缘油25号','TECHNICAL_COLLABORATION_SIMULATOR',b.evidence_ref,1 FROM sales_projects p JOIN quotation_design_bom_versions b ON b.project_id=p.id AND b.status='approved' WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY b.version DESC LIMIT 1;
INSERT OR IGNORE INTO `artifact_baseline_items` (`id`,`project_id`,`field_code`,`field_label`,`artifact_kind`,`artifact_version_id`,`value_text`,`source_system`,`evidence_ref`,`simulated`)
SELECT 'BASE-500-BOM-SCOPE',p.id,'supply_scope','供货范围','solution_bom',b.id,'500kV变压器大修服务：绕组更换、铁芯叠装、套管更换、绝缘油处理及色谱分析','TECHNICAL_COLLABORATION_SIMULATOR',b.evidence_ref,1 FROM sales_projects p JOIN quotation_design_bom_versions b ON b.project_id=p.id AND b.status='approved' WHERE p.project_code='QJ-20260826-C7C9B6' ORDER BY b.version DESC LIMIT 1;
