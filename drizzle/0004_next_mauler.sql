CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`teacherId` int NOT NULL,
	`inviteCode` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `classes_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','moderator') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `classId` int;--> statement-breakpoint
CREATE INDEX `teacher_idx` ON `classes` (`teacherId`);--> statement-breakpoint
CREATE INDEX `invite_code_idx` ON `classes` (`inviteCode`);--> statement-breakpoint
CREATE INDEX `class_idx` ON `users` (`classId`);