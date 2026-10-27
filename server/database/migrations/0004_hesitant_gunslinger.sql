CREATE TABLE `work_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_sessions_order" CHECK("work_sessions"."ended_at" is null or "work_sessions"."ended_at" >= "work_sessions"."started_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_sessions_running_idx` ON `work_sessions` (`user_id`) WHERE "work_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX `work_sessions_user_idx` ON `work_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `work_sessions_task_idx` ON `work_sessions` (`task_id`);