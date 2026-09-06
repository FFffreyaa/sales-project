INSERT INTO `lead_requirement_snapshots` (
	`id`, `project_id`, `source_system`, `lead_id`, `lead_code`, `snapshot_version`,
	`original_text`, `requirement_snapshot`, `source_refs`, `field_provenance`,
	`source_occurred_at`, `immutable`
)
SELECT
	lower(hex(randomblob(16))),
	l.`project_id`,
	l.`source_system`,
	l.`source_object_id`,
	COALESCE(l.`source_object_code`, l.`source_object_id`),
	1,
	COALESCE(
		json_extract(l.`source_snapshot`, '$.initialRequirement.originalText'),
		json_extract(l.`source_snapshot`, '$.opportunity.productScope'),
		'旧版线索事件未提供初始需求原文'
	),
	COALESCE(
		json_extract(l.`source_snapshot`, '$.initialRequirement'),
		json_object(
			'originalText', COALESCE(json_extract(l.`source_snapshot`, '$.opportunity.productScope'), '旧版线索事件未提供初始需求原文'),
			'productRequirement', COALESCE(json_extract(l.`source_snapshot`, '$.opportunity.productScope'), '待澄清'),
			'quantity', json_extract(l.`source_snapshot`, '$.opportunity.quantity'),
			'knownConstraints', json_array(),
			'unknowns', json_array('旧版线索事件缺少结构化需求字段，请在项目澄清中补充'),
			'sourceRefs', COALESCE(json_extract(l.`source_snapshot`, '$.evidenceRefs'), json_array())
		)
	),
	COALESCE(json_extract(l.`source_snapshot`, '$.initialRequirement.sourceRefs'), json_extract(l.`source_snapshot`, '$.evidenceRefs'), json_array()),
	l.`field_provenance`,
	l.`imported_at`,
	1
FROM `project_source_links` l
WHERE l.`source_object_type` = 'Lead'
	AND NOT EXISTS (
		SELECT 1 FROM `lead_requirement_snapshots` r WHERE r.`project_id` = l.`project_id`
	);
