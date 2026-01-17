import { Controller, Get } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { HealthCheckResult } from "@nestjs/terminus";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiDoc, SWAGGER_TAGS } from "@/common/swagger";
import { DatabaseHealthIndicator } from "./indicators/database.health";

@ApiTags(SWAGGER_TAGS.COMMON_HEALTH)
@Controller("health")
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly databaseHealth: DatabaseHealthIndicator,
	) {}

	@Get()
	@HealthCheck()
	@ApiDoc({
		summary: "서버 상태 확인",
		description: "데이터베이스 연결 등 서버 상태를 확인합니다.",
		includeCommonErrors: false,
	})
	@ApiResponse({ status: 200, description: "서버가 정상 동작 중입니다." })
	@ApiResponse({ status: 503, description: "서버에 문제가 발생했습니다." })
	check(): Promise<HealthCheckResult> {
		return this.health.check([() => this.databaseHealth.isHealthy("database")]);
	}
}
