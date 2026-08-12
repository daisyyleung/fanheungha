CREATE TABLE `list_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`normalized_key` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_list_sections_trip_kind_key` ON `list_sections` (`trip_id`,`kind`,`normalized_key`);
--> statement-breakpoint
CREATE INDEX `idx_list_sections_trip_kind_sort` ON `list_sections` (`trip_id`,`kind`,`archived_at`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `section_id` text REFERENCES list_sections(id);
--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_shopping_section_sort` ON `shopping_items` (`trip_id`,`section_id`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `food_items` ADD `section_id` text REFERENCES list_sections(id);
--> statement-breakpoint
ALTER TABLE `food_items` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_food_section_sort` ON `food_items` (`trip_id`,`section_id`,`sort_order`);
