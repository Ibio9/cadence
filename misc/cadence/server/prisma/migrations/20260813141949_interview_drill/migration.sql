-- CreateTable
CREATE TABLE "InterviewTopic" (
    "id" TEXT NOT NULL,
    "strand" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "tests" TEXT NOT NULL DEFAULT '',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "strand" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "prepSec" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'prep',
    "weakness" TEXT,
    "nextTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "transcript" TEXT NOT NULL DEFAULT '',
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "scores" JSONB,
    "critique" JSONB,
    "modelAnswer" TEXT,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewTopic_strand_idx" ON "InterviewTopic"("strand");

-- CreateIndex
CREATE INDEX "InterviewTopic_usedAt_idx" ON "InterviewTopic"("usedAt");

-- CreateIndex
CREATE INDEX "InterviewSession_createdAt_idx" ON "InterviewSession"("createdAt");

-- CreateIndex
CREATE INDEX "InterviewRound_sessionId_idx" ON "InterviewRound"("sessionId");

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "InterviewTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
