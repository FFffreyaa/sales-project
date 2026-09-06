CREATE UNIQUE INDEX IF NOT EXISTS `stage_gate_instances_project_gate_uq`
ON `stage_gate_instances` (`project_id`,`gate_code`);
