CREATE TABLE `project_competitor_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`competitor_name` text NOT NULL,
	`competitor_role` text NOT NULL,
	`relationship_score` integer NOT NULL,
	`technical_score` integer NOT NULL,
	`price_score` integer NOT NULL,
	`delivery_score` integer NOT NULL,
	`service_score` integer NOT NULL,
	`confidence` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`observed_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `project_competitor_facts_role_ck` CHECK(`competitor_role` in ('主要对手','低价挑战者','在位供应商','替代方案')),
	CONSTRAINT `project_competitor_facts_confidence_ck` CHECK(`confidence` in ('高','中','低')),
	CONSTRAINT `project_competitor_facts_scores_ck` CHECK(`relationship_score` between 0 and 100 and `technical_score` between 0 and 100 and `price_score` between 0 and 100 and `delivery_score` between 0 and 100 and `service_score` between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `project_competitor_facts_project_idx` ON `project_competitor_facts` (`project_id`,`observed_at`);
