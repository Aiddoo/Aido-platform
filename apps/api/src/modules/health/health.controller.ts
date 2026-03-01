import { Controller, Get, Logger } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { HealthCheckResult } from "@nestjs/terminus";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiDoc, SWAGGER_TAGS } from "@/common/swagger";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { DatabaseHealthIndicator } from "./indicators/database.health";

@ApiTags(SWAGGER_TAGS.COMMON_HEALTH)
@Controller("health")
export class HealthController {
	readonly #logger = new Logger(HealthController.name);

	constructor(
		private readonly health: HealthCheckService,
		private readonly databaseHealth: DatabaseHealthIndicator,
	) {}

	@Get()
	@Public()
	@HealthCheck()
	@ApiDoc({
		summary: "서버 상태 확인",
		operationId: "healthCheck",
		description: `
## 🏥 헬스 체크

서버 및 외부 서비스 연결 상태를 확인합니다.

### 체크 항목
| 항목 | 설명 |
|------|------|
| \`database\` | PostgreSQL 데이터베이스 연결 상태 |

### 응답 상태
- \`up\`: 정상 동작 중
- \`down\`: 서비스 이상

### 사용 예시
\`\`\`bash
curl https://api.aido.com/health
\`\`\`

### 모니터링
- 주기적인 헬스 체크로 서비스 가용성 모니터링
- 503 응답 시 즉시 알림 트리거
		`,
		includeCommonErrors: false,
	})
	@ApiResponse({
		status: 200,
		description: "서버가 정상 동작 중입니다.",
		schema: {
			example: {
				status: "ok",
				info: { database: { status: "up" } },
				error: {},
				details: { database: { status: "up" } },
			},
		},
	})
	@ApiResponse({
		status: 503,
		description: "서버에 문제가 발생했습니다.",
		schema: {
			example: {
				status: "error",
				info: {},
				error: { database: { status: "down", message: "Connection refused" } },
				details: {
					database: { status: "down", message: "Connection refused" },
				},
			},
		},
	})
	async check(): Promise<HealthCheckResult> {
		this.#logger.debug("헬스 체크 요청");
		const result = await this.health.check([
			() => this.databaseHealth.isHealthy("database"),
		]);
		this.#logger.log(`헬스 체크 완료: ${result.status}`);
		return result;
	}
}
