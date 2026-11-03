DROP INDEX "TodoComment_todoId_rootId_idx";--> statement-breakpoint
ALTER TABLE "TodoComment" ADD COLUMN "replyToCommentId" text;--> statement-breakpoint
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_replyToCommentId_fkey" FOREIGN KEY ("replyToCommentId") REFERENCES "TodoComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
-- 답글은 모두 묶음 머리(댓글) 바로 아래로 옮기고, 원래 직계 부모는 답글 대상으로 남긴다.
-- rootId·path·depth도 2단계 값으로 맞춰 이전 API 이미지로 롤백해도 같은 묶음으로 읽힌다.
UPDATE "TodoComment"
SET
	"replyToCommentId" = "parentId",
	"parentId" = COALESCE("rootId", "path"[1], "parentId"),
	"rootId" = COALESCE("rootId", "path"[1], "parentId"),
	"depth" = 1,
	"path" = ARRAY[COALESCE("rootId", "path"[1], "parentId")]::text[]
WHERE "parentId" IS NOT NULL
	AND "replyToCommentId" IS NULL;--> statement-breakpoint
CREATE INDEX "TodoComment_parentId_createdAt_id_idx" ON "TodoComment" ("parentId","createdAt","id");--> statement-breakpoint
-- 댓글의 답글 수는 목록에 보이는 답글(삭제되지 않은 답글) 수다. 답글은 답글 수를 갖지 않는다.
UPDATE "TodoComment" AS "comment"
SET "replyCount" = "visible"."replyCount"
FROM (
	SELECT
		"head"."id",
		(
			SELECT COUNT(*)::integer
			FROM "TodoComment" AS "reply"
			WHERE "reply"."parentId" = "head"."id"
				AND "reply"."deletedAt" IS NULL
		) AS "replyCount"
	FROM "TodoComment" AS "head"
	WHERE "head"."parentId" IS NULL
) AS "visible"
WHERE "comment"."id" = "visible"."id"
	AND "comment"."replyCount" IS DISTINCT FROM "visible"."replyCount";--> statement-breakpoint
UPDATE "TodoComment" SET "replyCount" = 0 WHERE "parentId" IS NOT NULL AND "replyCount" <> 0;
