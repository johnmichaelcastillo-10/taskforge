CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'gray' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_color" CHECK(color in ('gray', 'red', 'orange', 'amber', 'green', 'teal', 'sky', 'indigo', 'purple', 'pink'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_owner_name_idx` ON `tags` (`owner_id`,"name" collate nocase);--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_idx` ON `task_comments` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_tags_tag_idx` ON `task_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`estimate_minutes` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_status" CHECK("tasks"."status" in ('backlog', 'todo', 'in_progress', 'done')),
	CONSTRAINT "tasks_priority" CHECK("tasks"."priority" in ('low', 'medium', 'high')),
	CONSTRAINT "tasks_estimate" CHECK("tasks"."estimate_minutes" is null or "tasks"."estimate_minutes" between 1 and 99999),
	CONSTRAINT "tasks_completed" CHECK(("tasks"."status" = 'done') = ("tasks"."completed_at" is not null))
);
--> statement-breakpoint
CREATE INDEX `tasks_board_idx` ON `tasks` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`project_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_completed_idx` ON `tasks` (`completed_at`);