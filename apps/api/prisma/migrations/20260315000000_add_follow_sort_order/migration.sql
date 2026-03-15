-- AlterTable
ALTER TABLE "Follow" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Follow_followerId_sortOrder_idx" ON "Follow"("followerId", "sortOrder");

-- DataMigration: 기존 ACCEPTED 팔로우에 createdAt DESC 기준 순차적 sortOrder 할당
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "followerId" ORDER BY "createdAt" DESC, id DESC) - 1 AS new_order
  FROM "Follow"
  WHERE status = 'ACCEPTED'
)
UPDATE "Follow" f SET "sortOrder" = r.new_order FROM ranked r WHERE f.id = r.id;
