CREATE TABLE "AppRelease" (
	"latestVersion" varchar(32) NOT NULL,
	"platform" varchar(16) PRIMARY KEY,
	"updatedAt" timestamp(3) NOT NULL
);
