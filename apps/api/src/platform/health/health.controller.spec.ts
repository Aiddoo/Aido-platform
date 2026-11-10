import { TerminusModule } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { appConfig } from "#api/platform/config/app.config";

import { HealthController } from "./health.controller.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";
import { JobRuntimeHealthIndicator } from "./indicators/job-runtime.health.js";
import { OutboundHealthIndicator } from "./indicators/outbound.health.js";
import { RuntimeStatsHealthIndicator } from "./indicators/runtime-stats.health.js";

const upIndicator = { isHealthy: (key: string) => ({ [key]: { status: "up" } }) };

async function createController(instanceId: string | undefined): Promise<HealthController> {
  const module = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [
      { provide: DatabaseHealthIndicator, useValue: upIndicator },
      { provide: JobRuntimeHealthIndicator, useValue: upIndicator },
      { provide: OutboundHealthIndicator, useValue: upIndicator },
      { provide: RuntimeStatsHealthIndicator, useValue: upIndicator },
      { provide: appConfig.KEY, useValue: { instanceId } },
    ],
  }).compile();
  return module.get(HealthController);
}

describe("HealthController — 헬스 체크 컨트롤러", () => {
  it("INSTANCE_ID가 있으면 지표 결과에 그 식별자를 붙인다", async () => {
    // Given
    const controller = await createController("api-1");

    // When
    const result = await controller.check();

    // Then
    expect(result).toMatchObject({
      status: "ok",
      details: { database: { status: "up" }, queues: { status: "up" } },
      instanceId: "api-1",
    });
  });

  it("INSTANCE_ID가 없으면 기동 때 정한 8자 식별자를 요청마다 같게 붙인다", async () => {
    // Given
    const controller = await createController(undefined);

    // When
    const [first, second] = [await controller.check(), await controller.check()];

    // Then
    expect(first.instanceId).toHaveLength(8);
    expect(second.instanceId).toBe(first.instanceId);
  });
});
