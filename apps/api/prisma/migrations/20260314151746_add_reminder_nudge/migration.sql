-- CreateTable
CREATE TABLE "ReminderNudge" (
    "id" SERIAL NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "message" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderNudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderNudge_senderId_receiverId_createdAt_idx" ON "ReminderNudge"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderNudge_receiverId_createdAt_idx" ON "ReminderNudge"("receiverId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReminderNudge" ADD CONSTRAINT "ReminderNudge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderNudge" ADD CONSTRAINT "ReminderNudge_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
