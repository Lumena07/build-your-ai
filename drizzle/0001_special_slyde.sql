CREATE TABLE `course_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`seen_at` integer NOT NULL,
	`call_id` text
);
