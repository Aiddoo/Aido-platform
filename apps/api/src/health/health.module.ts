import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller";
import { BullHealthIndicator } from "./indicators/bull.health";
import { DatabaseHealthIndicator } from "./indicators/database.health";

@Module({
	imports: [TerminusModule],
	controllers: [HealthController],
	providers: [DatabaseHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}
