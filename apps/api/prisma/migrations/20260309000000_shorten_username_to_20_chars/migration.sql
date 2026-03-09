-- 기존 20자 초과 데이터 잘라내기
UPDATE "UserProfile" SET "name" = LEFT("name", 20) WHERE LENGTH("name") > 20;
UPDATE "OAuthState" SET "userName" = LEFT("userName", 20) WHERE LENGTH("userName") > 20;

-- AlterTable
ALTER TABLE "UserProfile" ALTER COLUMN "name" SET DATA TYPE VARCHAR(20);
ALTER TABLE "OAuthState" ALTER COLUMN "userName" SET DATA TYPE VARCHAR(20);
