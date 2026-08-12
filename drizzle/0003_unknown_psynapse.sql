CREATE TABLE `improvement_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_improvement_notes_status` ON `improvement_notes` (`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `itinerary_items` ADD `day_period` text DEFAULT 'allDay' NOT NULL;