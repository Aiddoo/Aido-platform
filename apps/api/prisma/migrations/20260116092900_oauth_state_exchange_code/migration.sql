-- DropTable (OAuthExchangeCode 제거)
DROP TABLE IF EXISTS "OAuthExchangeCode";

-- AlterTable (OAuthState에 교환 코드 필드 추가)
ALTER TABLE "OAuthState" ADD COLUMN "exchangeCode" VARCHAR(64);
ALTER TABLE "OAuthState" ADD COLUMN "accessToken" VARCHAR(1000);
ALTER TABLE "OAuthState" ADD COLUMN "refreshToken" VARCHAR(1000);
ALTER TABLE "OAuthState" ADD COLUMN "userId" VARCHAR(30);
ALTER TABLE "OAuthState" ADD COLUMN "userName" VARCHAR(100);
ALTER TABLE "OAuthState" ADD COLUMN "profileImage" VARCHAR(500);
ALTER TABLE "OAuthState" ADD COLUMN "ipAddress" VARCHAR(45);
ALTER TABLE "OAuthState" ADD COLUMN "userAgent" VARCHAR(500);
ALTER TABLE "OAuthState" ADD COLUMN "exchangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_exchangeCode_key" ON "OAuthState"("exchangeCode");

-- CreateIndex
CREATE INDEX "OAuthState_exchangeCode_idx" ON "OAuthState"("exchangeCode");
