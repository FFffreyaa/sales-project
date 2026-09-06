-- G7当前只接收下游权威事实的只读投影；本迁移不定义经营关闭阈值，也不开放G7人工关闭。
CREATE TABLE `downstream_business_events` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `sales_projects`(`id`),
  `source_system` text NOT NULL,
  `source_event_id` text NOT NULL,
  `external_task_id` text NOT NULL,
  `object_type` text NOT NULL CHECK (`object_type` IN ('Contract','Order','Delivery','Acceptance','Invoice','Payment')),
  `object_ref` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('ContractStatusReported','OrderStatusReported','DeliveryStatusReported','AcceptanceStatusReported','InvoiceStatusReported','PaymentStatusReported')),
  `business_status` text NOT NULL,
  `amount_cents` integer,
  `currency` text,
  `evidence_ref` text NOT NULL,
  `occurred_at` text NOT NULL,
  `environment` text DEFAULT 'demo' NOT NULL,
  `simulated` integer DEFAULT true NOT NULL,
  `payload` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `downstream_business_events_source_uq` ON `downstream_business_events` (`source_system`,`source_event_id`);
CREATE INDEX `downstream_business_events_project_idx` ON `downstream_business_events` (`project_id`,`object_type`,`occurred_at`);
--> statement-breakpoint
PRAGMA optimize;
