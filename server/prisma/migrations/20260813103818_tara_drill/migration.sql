-- CreateTable
CREATE TABLE "TaraQuestion" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "passage" TEXT NOT NULL DEFAULT '',
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT '',
    "distractors" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "origin" TEXT NOT NULL DEFAULT 'generated',
    "source" TEXT,
    "flaw" TEXT,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaraQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaraAttempt" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosen" TEXT,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'practice',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaraAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaraPrompt" (
    "id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "q1" TEXT NOT NULL,
    "q2" TEXT NOT NULL,
    "q3" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaraPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaraEssay" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "words" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "mark" JSONB,
    "exemplar" TEXT,
    "divergences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaraEssay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaraQuestion_module_subcategory_idx" ON "TaraQuestion"("module", "subcategory");

-- CreateIndex
CREATE INDEX "TaraQuestion_origin_idx" ON "TaraQuestion"("origin");

-- CreateIndex
CREATE INDEX "TaraAttempt_questionId_idx" ON "TaraAttempt"("questionId");

-- CreateIndex
CREATE INDEX "TaraAttempt_createdAt_idx" ON "TaraAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "TaraEssay_promptId_idx" ON "TaraEssay"("promptId");

-- AddForeignKey
ALTER TABLE "TaraAttempt" ADD CONSTRAINT "TaraAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TaraQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaraEssay" ADD CONSTRAINT "TaraEssay_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "TaraPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
