ALTER TABLE `game_answers` ADD `questionType` varchar(64);--> statement-breakpoint
ALTER TABLE `game_answers` ADD `question` text;--> statement-breakpoint
ALTER TABLE `game_answers` ADD `difficulty` enum('easy','medium','hard');--> statement-breakpoint
ALTER TABLE `game_answers` ADD `correctOption` int;--> statement-breakpoint
ALTER TABLE `game_answers` ADD `option1` varchar(255);--> statement-breakpoint
ALTER TABLE `game_answers` ADD `option2` varchar(255);--> statement-breakpoint
ALTER TABLE `game_answers` ADD `option3` varchar(255);--> statement-breakpoint
ALTER TABLE `game_answers` ADD `option4` varchar(255);--> statement-breakpoint
ALTER TABLE `game_answers` ADD `userSelectedOption` int;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `difficulty` enum('easy','medium','hard') DEFAULT 'easy' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_answers` DROP COLUMN `definition`;--> statement-breakpoint
ALTER TABLE `game_answers` DROP COLUMN `userAnswer`;