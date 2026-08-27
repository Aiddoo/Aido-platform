-- 계정 purge가 댓글을 먼저 묘비화·익명화한 뒤 User를 지우도록 데이터 수명을 분리합니다.
-- RESTRICT는 cleanup 누락 시 댓글/카운터를 조용히 유실하지 않는 마지막 안전망입니다.
-- PostgreSQL migration은 자동 transaction을 가정하지 않습니다. CASCADE와 RESTRICT가
-- 동시에 노출되는 중간 상태를 구 purge job이 보지 못하도록 교체 전체를 원자적으로 공개합니다.
-- 작성자 FK는 배포 롤백한 구 API도 항상 역참조할 수 있어야 하므로 nullable로 바꾸지 않습니다.
-- 삭제된 댓글은 개인정보가 없는 잠긴 시스템 작성자로 옮기고, API는 deletedAt을 보고 묘비로 표시합니다.
BEGIN;

-- 공개 email/userTag validator가 만들 수 없는 DB 전용 식별자를 쓰므로
-- 정상 사용자와 충돌하지 않습니다. 수동으로 생성된 충돌은 명시적으로 중단합니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE ("email" = 'system:deleted-comment-author' OR "userTag" = '_DELETED')
      AND "id" <> 'cm1deletedcommentauthor000001'
  ) THEN
    RAISE EXCEPTION '댓글 삭제 시스템 사용자의 email 또는 userTag가 이미 사용 중입니다.';
  END IF;
END $$;

INSERT INTO "User" (
  "id",
  "email",
  "userTag",
  "role",
  "status",
  "subscriptionStatus",
  "aiUsageCount",
  "aiUsageResetAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  'cm1deletedcommentauthor000001',
  'system:deleted-comment-author',
  '_DELETED',
  'USER',
  'LOCKED',
  'FREE',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "User"
    WHERE "id" = 'cm1deletedcommentauthor000001'
      AND "email" = 'system:deleted-comment-author'
      AND "userTag" = '_DELETED'
      AND "status" = 'LOCKED'
      AND "deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Account" WHERE "Account"."userId" = "User"."id"
      )
  ) THEN
    RAISE EXCEPTION '댓글 삭제 시스템 사용자 불변식을 확인해 주세요.';
  END IF;
END $$;

-- 기존 CASCADE를 유지한 채 새 RESTRICT를 검증하고 교체해 무제약 배포 구간을 만들지 않습니다.
ALTER TABLE "TodoComment"
ADD CONSTRAINT "TodoComment_authorId_restrict_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "TodoCommentLike"
ADD CONSTRAINT "TodoCommentLike_userId_restrict_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "TodoComment"
VALIDATE CONSTRAINT "TodoComment_authorId_restrict_fkey";
ALTER TABLE "TodoCommentLike"
VALIDATE CONSTRAINT "TodoCommentLike_userId_restrict_fkey";

ALTER TABLE "TodoComment"
DROP CONSTRAINT "TodoComment_authorId_fkey";
ALTER TABLE "TodoCommentLike"
DROP CONSTRAINT "TodoCommentLike_userId_fkey";

ALTER TABLE "TodoComment"
RENAME CONSTRAINT "TodoComment_authorId_restrict_fkey" TO "TodoComment_authorId_fkey";
ALTER TABLE "TodoCommentLike"
RENAME CONSTRAINT "TodoCommentLike_userId_restrict_fkey" TO "TodoCommentLike_userId_fkey";

COMMIT;
