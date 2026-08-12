ALTER TABLE `itinerary_items` ADD `category` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_itinerary_active_weather_day` ON `itinerary_items` (`trip_id`,`item_date`) WHERE category = 'weather' AND archived_at IS NULL;--> statement-breakpoint
ALTER TABLE `trips` ADD `mode` text DEFAULT 'plan' NOT NULL;