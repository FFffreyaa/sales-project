ALTER TABLE `procurement_intents` ADD `scenario_code` text DEFAULT 'SCN-03-DIRECT-RFQ' NOT NULL;--> statement-breakpoint
UPDATE `procurement_intents` SET `scenario_code` = CASE WHEN `intent_type` IN ('标书','公开招标','TenderRequest') THEN 'SCN-01-DIRECT-BID' WHEN `intent_type` IN ('渠道机会','EPCInquiry') THEN 'SCN-02-EPC-INQUIRY' ELSE 'SCN-03-DIRECT-RFQ' END;
