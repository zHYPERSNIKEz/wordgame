CREATE TABLE `admin_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricType` varchar(64) NOT NULL,
	`metricKey` varchar(255) NOT NULL,
	`metricValue` decimal(12,2) NOT NULL,
	`userCount` int NOT NULL DEFAULT 0,
	`sessionCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`word` varchar(255) NOT NULL,
	`definition` text,
	`userAnswer` varchar(255) NOT NULL,
	`isCorrect` boolean NOT NULL,
	`pointsEarned` int NOT NULL DEFAULT 0,
	`timeSpentSeconds` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`totalScore` int NOT NULL DEFAULT 0,
	`totalAnswers` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`incorrectAnswers` int NOT NULL DEFAULT 0,
	`durationSeconds` int,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalSessions` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`totalAnswers` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`incorrectAnswers` int NOT NULL DEFAULT 0,
	`averageAccuracy` decimal(5,2) NOT NULL DEFAULT '0.00',
	`totalPlayTimeSeconds` int NOT NULL DEFAULT 0,
	`averageSessionDuration` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_stats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `age` int;--> statement-breakpoint
ALTER TABLE `users` ADD `school` varchar(255);--> statement-breakpoint
CREATE INDEX `metric_type_idx` ON `admin_metrics` (`metricType`);--> statement-breakpoint
CREATE INDEX `session_id_idx` ON `game_answers` (`sessionId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `game_answers` (`userId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `game_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `started_at_idx` ON `game_sessions` (`startedAt`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `user_stats` (`userId`);--> statement-breakpoint
CREATE INDEX `age_idx` ON `users` (`age`);--> statement-breakpoint
CREATE INDEX `school_idx` ON `users` (`school`);