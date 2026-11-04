CREATE TYPE "PushPermissionStatus" AS ENUM('GRANTED', 'PROVISIONAL', 'DENIED', 'NOT_DETERMINED');--> statement-breakpoint
CREATE TABLE "PushDevice" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deviceId" varchar(255) NOT NULL,
	"deviceModel" varchar(40),
	"id" text PRIMARY KEY,
	"osVersion" varchar(20),
	"permissionCanAskAgain" boolean NOT NULL,
	"permissionStatus" "PushPermissionStatus" NOT NULL,
	"platform" "Platform" NOT NULL,
	"reportedAt" timestamp(3) NOT NULL,
	"sessionId" text,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "PushDevice_userId_deviceId_key" UNIQUE("userId","deviceId")
);
--> statement-breakpoint
ALTER TABLE "PushToken" ADD COLUMN "sessionId" text;--> statement-breakpoint
CREATE INDEX "PushDevice_sessionId_idx" ON "PushDevice" ("sessionId");--> statement-breakpoint
CREATE INDEX "PushDevice_deviceId_idx" ON "PushDevice" ("deviceId");--> statement-breakpoint
CREATE INDEX "PushToken_sessionId_idx" ON "PushToken" ("sessionId");--> statement-breakpoint
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
-- 구 API가 플랫폼을 받지 않아 모두 IOS로 저장됐다. 앱은 첫 푸시 버전부터 deviceId를 플랫폼 접두어로 만든다.
UPDATE "PushToken" SET "platform" = 'ANDROID' WHERE "deviceId" LIKE 'android\_%' AND "platform" <> 'ANDROID';--> statement-breakpoint
-- 활성 토큰은 권한을 허용한 기기에서만 등록됐다.
INSERT INTO "PushDevice" ("id", "userId", "deviceId", "platform", "permissionStatus", "permissionCanAskAgain", "reportedAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", "deviceId", "platform", 'GRANTED', false, "updatedAt", now()
FROM "PushToken"
WHERE "isActive"
ON CONFLICT ("userId", "deviceId") DO NOTHING;
