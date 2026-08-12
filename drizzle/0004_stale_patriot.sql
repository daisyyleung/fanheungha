CREATE TABLE `food_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`shop` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`tried` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_food_trip_created` ON `food_items` (`trip_id`,`created_at`);