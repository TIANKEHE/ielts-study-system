ALTER TABLE "Book" ADD COLUMN "key" TEXT;

ALTER TABLE "Chapter" ADD COLUMN "key" TEXT;

ALTER TABLE "Chapter" ADD COLUMN "part" INTEGER;

ALTER TABLE "Chapter" ADD COLUMN "test" INTEGER;

ALTER TABLE "Chapter" ADD COLUMN "volume" INTEGER;

ALTER TABLE "Correction" ADD COLUMN "sourceId" TEXT;

ALTER TABLE "Correction" ADD COLUMN "trainingItemKey" TEXT;

ALTER TABLE Setting ADD COLUMN audioAuto BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE Setting ADD COLUMN audioAccent TEXT NOT NULL DEFAULT 'en-GB';

ALTER TABLE Setting ADD COLUMN audioRate REAL NOT NULL DEFAULT 1;

ALTER TABLE Setting ADD COLUMN audioEveryRepeat BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE Task ADD COLUMN isCambridge BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE Source ADD COLUMN learnedCount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE Source ADD COLUMN errorCount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE Source ADD COLUMN lastLearnedAt DATETIME;

CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'CORRECTION',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "currentErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE TABLE "TrainingSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DataMigration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "details" TEXT NOT NULL DEFAULT '',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS Source_wordId_chapterId_key;

CREATE INDEX "Source_chapterId_position_idx" ON "Source"("chapterId", "position");

CREATE INDEX "Source_wordId_chapterId_idx" ON "Source"("wordId", "chapterId");

CREATE INDEX "TrainingSession_scopeKey_mode_completedAt_idx" ON "TrainingSession"("scopeKey", "mode", "completedAt");

CREATE UNIQUE INDEX "Book_key_key" ON "Book"("key");

CREATE UNIQUE INDEX "Chapter_key_key" ON "Chapter"("key");

CREATE UNIQUE INDEX "Correction_trainingItemKey_key" ON "Correction"("trainingItemKey");