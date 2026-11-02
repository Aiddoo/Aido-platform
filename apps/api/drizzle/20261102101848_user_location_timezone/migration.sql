ALTER TABLE "UserLocation" ADD COLUMN "timezone" varchar(50);--> statement-breakpoint
ALTER TABLE "UserLocation" ALTER COLUMN "gridX" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "UserLocation" ALTER COLUMN "gridY" DROP NOT NULL;