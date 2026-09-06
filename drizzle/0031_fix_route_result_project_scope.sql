DROP INDEX IF EXISTS `quotation_route_results_route_effective_uq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_route_results_project_route_effective_uq`
ON `quotation_route_results` (`project_id`,`route_id`)
WHERE `status`='effective';
--> statement-breakpoint
PRAGMA optimize;
