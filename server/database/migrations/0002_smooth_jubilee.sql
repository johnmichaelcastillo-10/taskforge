CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`project_id` integer,
	`task_id` integer,
	`action` text NOT NULL,
	`subject` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_project_idx` ON `activity_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`start_date` text,
	`deadline` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "projects_status" CHECK("projects"."status" in ('planning', 'in_progress', 'completed')),
	CONSTRAINT "projects_priority" CHECK("projects"."priority" in ('low', 'medium', 'high')),
	CONSTRAINT "projects_dates" CHECK("projects"."start_date" is null or "projects"."deadline" is null or "projects"."deadline" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`,`archived_at`);