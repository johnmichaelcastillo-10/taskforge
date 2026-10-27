CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`password_hash` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`demo_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "users_account_kind" CHECK(("users"."is_demo" = 1 and "users"."demo_expires_at" is not null and "users"."email" is null and "users"."password_hash" is null)
        or ("users"."is_demo" = 0 and "users"."demo_expires_at" is null and "users"."email" is not null and "users"."password_hash" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);