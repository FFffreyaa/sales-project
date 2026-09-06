ALTER TABLE `professional_reviews` ADD COLUMN `version` integer DEFAULT 1 NOT NULL;
ALTER TABLE `professional_reviews` ADD COLUMN `status` text DEFAULT 'effective' NOT NULL;
ALTER TABLE `professional_reviews` ADD COLUMN `remediation_id` text;

DROP INDEX `professional_reviews_package_type_uq`;
CREATE UNIQUE INDEX `professional_reviews_effective_package_type_uq`
  ON `professional_reviews` (`bid_package_version_id`,`review_type`)
  WHERE `status`='effective';

CREATE TABLE `professional_review_remediations` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `professional_review_id` text NOT NULL,
  `bid_package_version_id` text NOT NULL,
  `review_type` text NOT NULL,
  `issue_response` text NOT NULL,
  `evidence_ref` text NOT NULL,
  `status` text DEFAULT 'submitted' NOT NULL,
  `submitted_by` text NOT NULL,
  `verified_by` text,
  `verification_comment` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `sales_projects`(`id`),
  FOREIGN KEY (`professional_review_id`) REFERENCES `professional_reviews`(`id`),
  FOREIGN KEY (`bid_package_version_id`) REFERENCES `bid_package_versions`(`id`),
  FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`)
);

CREATE UNIQUE INDEX `professional_review_remediations_review_uq`
  ON `professional_review_remediations` (`professional_review_id`);
CREATE INDEX `professional_review_remediations_project_idx`
  ON `professional_review_remediations` (`project_id`,`status`);
