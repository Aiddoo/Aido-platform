-- AlterTable
ALTER TABLE "Todo"
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TodoComment" (
    "id" TEXT NOT NULL,
    "todoId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "rootCommentId" TEXT,
    "replyToCommentId" TEXT,
    "clientRequestId" UUID NOT NULL,
    "content" VARCHAR(500),
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TodoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoCommentLike" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TodoCommentLike_pkey" PRIMARY KEY ("commentId", "userId")
);

-- CreateTable
CREATE TABLE "TodoView" (
    "todoId" INTEGER NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TodoView_pkey" PRIMARY KEY ("todoId", "viewerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodoComment_authorId_clientRequestId_key" ON "TodoComment"("authorId", "clientRequestId");
CREATE INDEX "TodoComment_todoId_rootCommentId_createdAt_id_idx" ON "TodoComment"("todoId", "rootCommentId", "createdAt", "id");
CREATE INDEX "TodoComment_todoId_rootCommentId_likeCount_replyCount_createdAt_id_idx" ON "TodoComment"("todoId", "rootCommentId", "likeCount", "replyCount", "createdAt", "id");
CREATE INDEX "TodoComment_rootCommentId_createdAt_id_idx" ON "TodoComment"("rootCommentId", "createdAt", "id");
CREATE INDEX "TodoComment_replyToCommentId_idx" ON "TodoComment"("replyToCommentId");
CREATE INDEX "TodoCommentLike_userId_isActive_idx" ON "TodoCommentLike"("userId", "isActive");
CREATE INDEX "TodoView_viewerId_createdAt_idx" ON "TodoView"("viewerId", "createdAt");

-- AddForeignKey
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_rootCommentId_fkey" FOREIGN KEY ("rootCommentId") REFERENCES "TodoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_replyToCommentId_fkey" FOREIGN KEY ("replyToCommentId") REFERENCES "TodoComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TodoCommentLike" ADD CONSTRAINT "TodoCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TodoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoCommentLike" ADD CONSTRAINT "TodoCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoView" ADD CONSTRAINT "TodoView_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoView" ADD CONSTRAINT "TodoView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
