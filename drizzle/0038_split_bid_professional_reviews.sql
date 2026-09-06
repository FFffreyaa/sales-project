ALTER TABLE `professional_reviews` ADD COLUMN `review_type` text DEFAULT 'combined' NOT NULL;
--> statement-breakpoint
ALTER TABLE `professional_reviews` ADD COLUMN `review_summary` text DEFAULT '历史单一专业评审记录，未拆分商务、技术与资质维度' NOT NULL;
--> statement-breakpoint
DROP INDEX `professional_reviews_package_uq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_reviews_package_type_uq` ON `professional_reviews` (`bid_package_version_id`,`review_type`);
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES
  ('bid-technical-reviewer-qian','钱技术评审'),
  ('qualification-reviewer-he','何资质评审');
--> statement-breakpoint
INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES
  ('bid-technical-reviewer-qian','role-professional-reviewer'),
  ('qualification-reviewer-he','role-professional-reviewer');
