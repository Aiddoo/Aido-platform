import { randomUUID } from "node:crypto";

import { Controller, Get, Logger } from "@nestjs/common";
import { ApiResponse, ApiTags, type SchemaObject } from "@nestjs/swagger";
import type { HealthCheckResult } from "@nestjs/terminus";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { ApiDoc, SWAGGER_TAGS } from "#api/platform/http/swagger/index";

import { DatabaseHealthIndicator } from "./indicators/database.health.js";
import { JobRuntimeHealthIndicator } from "./indicators/job-runtime.health.js";

function describeHealthResponse(status: "ok" | "error"): SchemaObject {
  const indicator: SchemaObject = {
    type: "object",
    additionalProperties: true,
    properties: { status: { type: "string" } },
    required: ["status"],
  };
  return {
    type: "object",
    properties: {
      status: { type: "string", example: status },
      info: { type: "object", additionalProperties: indicator, nullable: true },
      error: { type: "object", additionalProperties: indicator, nullable: true },
      details: { type: "object", additionalProperties: indicator },
    },
  };
}

const INSTANCE_ID = process.env.INSTANCE_ID ?? randomUUID().slice(0, 8);

@ApiTags(SWAGGER_TAGS.COMMON_HEALTH)
@Controller("health")
export class HealthController {
  readonly #logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseHealth: DatabaseHealthIndicator,
    private readonly jobRuntimeHealth: JobRuntimeHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck({ swaggerDocumentation: false })
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
| \`queues\` | 선택된 영속 작업 backend의 큐 상태와 잡 카운트 |

### 응답 상태
- \`up\`: 정상 동작 중
- \`down\`: 서비스 이상

> \`queues\`는 작업 backend 장애 시에도 \`up\`을 유지하고 \`degraded: true\`를
> 덧붙입니다. 상태 조회 실패나 시간 초과의 \`reason\`은 \`job_runtime_health_timeout\`입니다.
> 큐 장애는 프로세스 재시작으로 해결되지 않으므로 503을 만들지 않습니다.
> 모니터링 알람은 \`degraded\` 필드를 기준으로 합니다.

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
      ...describeHealthResponse("ok"),
      example: {
        status: "ok",
        info: {
          database: { status: "up" },
          queues: { status: "up" },
        },
        error: {},
        details: {
          database: { status: "up" },
          queues: { status: "up" },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "서버에 문제가 발생했습니다.",
    schema: {
      ...describeHealthResponse("error"),
      example: {
        status: "error",
        info: { queues: { status: "up" } },
        error: { database: { status: "down", message: "Connection refused" } },
        details: {
          database: { status: "down", message: "Connection refused" },
          queues: { status: "up" },
        },
      },
    },
  })
  async check(): Promise<HealthCheckResult & { instanceId: string }> {
    this.#logger.debug("헬스 체크 요청");
    const result = await this.health.check([
      () => this.databaseHealth.isHealthy("database"),
      () => this.jobRuntimeHealth.isHealthy("queues"),
    ]);
    this.#logger.log(`헬스 체크 완료: ${result.status}`);
    return { ...result, instanceId: INSTANCE_ID };
  }
}
