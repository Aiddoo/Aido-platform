-- =============================================================================
-- 마이그레이션: TodoCategory 추가 및 Todo 스키마 수정
-- =============================================================================

-- 1. TodoCategory 테이블 생성
CREATE TABLE "TodoCategory" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoCategory_pkey" PRIMARY KEY ("id")
);

-- 2. TodoCategory 인덱스 생성
CREATE UNIQUE INDEX "TodoCategory_userId_name_key" ON "TodoCategory"("userId", "name");
CREATE INDEX "TodoCategory_userId_sortOrder_idx" ON "TodoCategory"("userId", "sortOrder");

-- 3. TodoCategory FK 생성
ALTER TABLE "TodoCategory" ADD CONSTRAINT "TodoCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. 기존 사용자들에게 기본 카테고리 생성 (Todo가 있는 사용자)
INSERT INTO "TodoCategory" ("userId", "name", "color", "sortOrder", "updatedAt")
SELECT DISTINCT "userId", '할 일', '#FF6B43', 0, NOW()
FROM "Todo"
ON CONFLICT ("userId", "name") DO NOTHING;

-- 5. Todo 테이블에 categoryId 컬럼 추가 (nullable로 먼저)
ALTER TABLE "Todo" ADD COLUMN "categoryId" INTEGER;

-- 6. Todo 테이블에 sortOrder 컬럼 추가
ALTER TABLE "Todo" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- 7. 기존 Todo에 기본 카테고리 연결
UPDATE "Todo" t
SET "categoryId" = c.id
FROM "TodoCategory" c
WHERE t."userId" = c."userId" AND c."name" = '할 일';

-- 8. categoryId NOT NULL 제약 추가
ALTER TABLE "Todo" ALTER COLUMN "categoryId" SET NOT NULL;

-- 9. Todo FK 생성 (onDelete: Restrict)
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. color 컬럼 삭제
ALTER TABLE "Todo" DROP COLUMN "color";

-- 11. 새 인덱스 추가
CREATE INDEX "Todo_userId_categoryId_idx" ON "Todo"("userId", "categoryId");
CREATE INDEX "Todo_userId_sortOrder_idx" ON "Todo"("userId", "sortOrder");
