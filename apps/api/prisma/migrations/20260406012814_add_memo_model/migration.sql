-- CreateTable
CREATE TABLE "Memo" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(5000) NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memo_userId_isPinned_sortOrder_idx" ON "Memo"("userId", "isPinned", "sortOrder");

-- CreateIndex
CREATE INDEX "Memo_userId_sortOrder_idx" ON "Memo"("userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
