ALTER TABLE `sales_projects` ADD `lead_grade` text;
--> statement-breakpoint
ALTER TABLE `sales_projects` ADD `project_importance` text;
--> statement-breakpoint
ALTER TABLE `sales_projects` ADD `project_importance_reason` text;
--> statement-breakpoint
UPDATE `sales_projects` SET `lead_grade`=`project_grade` WHERE `lead_grade` IS NULL;
--> statement-breakpoint
PRAGMA optimize;
