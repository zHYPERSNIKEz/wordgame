-- Add difficulty column to game_sessions
ALTER TABLE `game_sessions` ADD COLUMN `difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'easy' AFTER `userId`;

-- Update gameAnswers table to support multiple choice questions
ALTER TABLE `game_answers` 
ADD COLUMN `questionType` varchar(64) AFTER `word`,
ADD COLUMN `question` text AFTER `questionType`,
ADD COLUMN `difficulty` enum('easy','medium','hard') AFTER `question`,
ADD COLUMN `correctOption` int AFTER `difficulty`,
ADD COLUMN `option1` varchar(255) AFTER `correctOption`,
ADD COLUMN `option2` varchar(255) AFTER `option1`,
ADD COLUMN `option3` varchar(255) AFTER `option2`,
ADD COLUMN `option4` varchar(255) AFTER `option3`,
ADD COLUMN `userSelectedOption` int AFTER `option4`,
DROP COLUMN `definition`,
DROP COLUMN `userAnswer`;
