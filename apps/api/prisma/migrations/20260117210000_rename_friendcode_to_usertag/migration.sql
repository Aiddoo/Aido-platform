-- RenameColumn
ALTER TABLE "User" RENAME COLUMN "friendCode" TO "userTag";

-- RenameIndex (unique constraint)
ALTER INDEX "User_friendCode_key" RENAME TO "User_userTag_key";

-- CreateIndex (별도 인덱스 추가)
CREATE INDEX "User_userTag_idx" ON "User"("userTag");
