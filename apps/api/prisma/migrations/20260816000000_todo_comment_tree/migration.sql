-- 댓글을 2단 고정에서 임의 깊이 트리로 전환합니다.
-- 직계 부모(parentId) + 뿌리(rootId) + 조상 경로(path)를 두어 어떤 깊이에서도 답글을 받을 수 있게 합니다.

-- 1) 새 컬럼 추가
ALTER TABLE "TodoComment"
ADD COLUMN "parentId" TEXT,
ADD COLUMN "rootId" TEXT,
ADD COLUMN "path" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;

-- 2) 기존 2단 데이터 백필
--    답글의 직계 부모는 replyToCommentId(없으면 루트), 뿌리는 rootCommentId.
--    기존 구조상 깊이는 최대 1이므로 경로도 뿌리 하나로 채워집니다.
UPDATE "TodoComment"
SET "parentId" = COALESCE("replyToCommentId", "rootCommentId"),
    "rootId" = "rootCommentId",
    "path" = ARRAY["rootCommentId"],
    "depth" = 1
WHERE "rootCommentId" IS NOT NULL;

-- 3) 옛 인덱스·제약·컬럼 제거
DROP INDEX IF EXISTS "TodoComment_todoId_rootCommentId_createdAt_id_idx";
DROP INDEX IF EXISTS "TodoComment_todoId_rootCommentId_likeCount_replyCount_createdAt_id_idx";
DROP INDEX IF EXISTS "TodoComment_rootCommentId_createdAt_id_idx";
DROP INDEX IF EXISTS "TodoComment_replyToCommentId_idx";

ALTER TABLE "TodoComment" DROP CONSTRAINT IF EXISTS "TodoComment_rootCommentId_fkey";
ALTER TABLE "TodoComment" DROP CONSTRAINT IF EXISTS "TodoComment_replyToCommentId_fkey";

ALTER TABLE "TodoComment"
DROP COLUMN "rootCommentId",
DROP COLUMN "replyToCommentId";

-- 4) 새 인덱스·제약
CREATE INDEX "TodoComment_todoId_parentId_createdAt_id_idx" ON "TodoComment"("todoId", "parentId", "createdAt", "id");
-- 이름은 Prisma가 63자로 잘라 붙이는 형태를 그대로 씁니다 (migrate diff가 깨끗하도록)
CREATE INDEX "TodoComment_todoId_parentId_likeCount_replyCount_createdAt__idx" ON "TodoComment"("todoId", "parentId", "likeCount", "replyCount", "createdAt", "id");
CREATE INDEX "TodoComment_todoId_rootId_idx" ON "TodoComment"("todoId", "rootId");

ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TodoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
