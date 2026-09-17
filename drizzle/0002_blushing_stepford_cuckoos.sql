CREATE TABLE `course_access` (
	`email` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
