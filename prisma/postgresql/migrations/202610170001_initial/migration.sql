CREATE SCHEMA IF NOT EXISTS "kyes";
SET search_path TO "kyes";

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "intervals" TEXT NOT NULL DEFAULT '[1,3,7,14,30]',
    "reviewLimit" INTEGER NOT NULL DEFAULT 60,
    "writingGoal" INTEGER NOT NULL DEFAULT 12,
    "newGoal" INTEGER NOT NULL DEFAULT 20,
    "audioAuto" BOOLEAN NOT NULL DEFAULT true,
    "audioAccent" TEXT NOT NULL DEFAULT 'en-GB',
    "audioRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "audioEveryRepeat" BOOLEAN NOT NULL DEFAULT true,
    "budgetMinutes" INTEGER NOT NULL DEFAULT 240,
    "reviewGroupSize" INTEGER NOT NULL DEFAULT 20,
    "theme" TEXT NOT NULL DEFAULT 'eye',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "target" TEXT NOT NULL DEFAULT '稳步积累，完成今天的学习闭环',

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "volume" INTEGER,
    "test" INTEGER,
    "part" INTEGER,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "bookId" TEXT NOT NULL,
    "studyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "chinese" TEXT NOT NULL,
    "ipa" TEXT NOT NULL DEFAULT '',
    "pos" TEXT NOT NULL DEFAULT '',
    "example" TEXT NOT NULL DEFAULT '',
    "collocation" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "forms" TEXT NOT NULL DEFAULT '[]',
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstLearnedAt" TIMESTAMP(3),
    "lastLearnedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "mastery" TEXT NOT NULL DEFAULT 'NEW',
    "reviewStage" INTEGER NOT NULL DEFAULT 0,
    "crossDaySuccess" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "meaning" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "originalPosition" INTEGER NOT NULL DEFAULT 0,
    "importBatch" TEXT,
    "questionNumber" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "learnedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "firstLearnedAt" TIMESTAMP(3),
    "lastLearnedAt" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceLabel" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorRecord" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceLabel" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '拼写错误',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctionId" TEXT,

    CONSTRAINT "ErrorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "trainingItemKey" TEXT,
    "sourceId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "dueDay" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "success" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isCambridge" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL DEFAULT '',
    "planned" INTEGER NOT NULL DEFAULT 0,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speaking" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "question" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "improvements" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "audioUrl" TEXT,
    "aiFeedback" TEXT,

    CONSTRAINT "Speaking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "day" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "UsageAttempt" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "isReviewGroup" BOOLEAN NOT NULL DEFAULT false,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'CORRECTION',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "currentErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSubmission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataMigration" (
    "id" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyClock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "ownerId" TEXT,
    "skill" TEXT NOT NULL DEFAULT '听力',
    "module" TEXT NOT NULL DEFAULT '词汇学习',
    "budgeted" BOOLEAN NOT NULL DEFAULT true,
    "activeSpanId" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyClock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySpan" (
    "id" TEXT NOT NULL,
    "activeKey" TEXT,
    "skill" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "budgeted" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "confirmedUntil" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StudySpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_key_key" ON "Book"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_key_key" ON "Chapter"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Word_english_key" ON "Word"("english");

-- CreateIndex
CREATE INDEX "Source_chapterId_position_idx" ON "Source"("chapterId", "position");

-- CreateIndex
CREATE INDEX "Source_wordId_chapterId_idx" ON "Source"("wordId", "chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "Correction_trainingItemKey_key" ON "Correction"("trainingItemKey");

-- CreateIndex
CREATE UNIQUE INDEX "Review_wordId_dueDay_key" ON "Review"("wordId", "dueDay");

-- CreateIndex
CREATE UNIQUE INDEX "Task_day_key_key" ON "Task"("day", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Speaking_day_part_key" ON "Speaking"("day", "part");

-- CreateIndex
CREATE INDEX "TrainingSession_scopeKey_mode_completedAt_idx" ON "TrainingSession"("scopeKey", "mode", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudySpan_activeKey_key" ON "StudySpan"("activeKey");

-- CreateIndex
CREATE INDEX "StudySpan_startedAt_idx" ON "StudySpan"("startedAt");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorRecord" ADD CONSTRAINT "ErrorRecord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorRecord" ADD CONSTRAINT "ErrorRecord_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageAttempt" ADD CONSTRAINT "UsageAttempt_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma is server-only. No learning table is exposed to anonymous API users.
REVOKE ALL ON SCHEMA "kyes" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "kyes" FROM PUBLIC;
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='kyes' AND tablename<>'_prisma_migrations' LOOP
  EXECUTE format('ALTER TABLE kyes.%I ENABLE ROW LEVEL SECURITY',item.tablename);
 END LOOP;
END $$;
