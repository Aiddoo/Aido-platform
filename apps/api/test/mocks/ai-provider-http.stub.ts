import { readFileSync } from "node:fs";

import { generateText, Output } from "ai";
import { z } from "zod";

import {
  type AiAssistanceGenerationConfig,
  aiAssistanceGenerationConfig,
} from "#api/modules/ai-assistance/generation/ai-assistance-generation.config";
import {
  type AiProviderAdapter,
  AiProviderCatalog,
} from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-provider.adapter";
import { AiSdkGeneratorAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-sdk-generator.adapter";
import { AiSpendBudgetAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-spend-budget.adapter";
import type { UsageMeterPort } from "#api/platform/metering/usage-meter.port";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { DateClock } from "#test/doubles/platform/date-clock";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";

import { RecordingOperationalAlert } from "./recording-operational-alert.js";

export type AiProviderFixtureVendor = "anthropic" | "google" | "openai";

/** 업체 오류 응답 fixture. 파일 이름의 `<이름>.<HTTP 상태>.json`에서 상태를 읽는다. */
export function aiProviderErrorResponse(vendor: AiProviderFixtureVendor, fileName: string) {
  const status = Number(fileName.split(".").at(-2));
  const body = readFileSync(
    new URL(`../fixtures/providers/ai/${vendor}/${fileName}`, import.meta.url),
    "utf8",
  );
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

const AI_FIXTURE_KEYS = {
  ANTHROPIC_API_KEY: `sk-ant-fixture-${"a".repeat(30)}`,
  GOOGLE_GENERATIVE_AI_API_KEY: `fixture-${"g".repeat(30)}`,
  OPENAI_API_KEY: `sk-proj-fixture-${"o".repeat(30)}`,
} as const;

/** 업체 키와 AI 운영 env만 바꾼 설정. 외부 호출은 테스트가 fetch를 stub해 막는다. */
export function createAiTestConfig(env: Record<string, string> = {}): AiAssistanceGenerationConfig {
  return aiAssistanceGenerationConfig.parse({ ...AI_FIXTURE_KEYS, ...env });
}

/** 실제 업체 SDK로 한 번 호출해(재시도 없음) 던진 오류를 돌려준다. fetch는 테스트가 stub한다. */
export async function captureProviderError(
  adapter: Pick<AiProviderAdapter, "getModel">,
): Promise<unknown> {
  const model = adapter.getModel("parse-todo");
  if (model == null) {
    throw new Error("fixture adapter has no model");
  }
  return generateText({
    model: model.model,
    prompt: "fixture",
    output: Output.object({ schema: z.object({ title: z.string() }) }),
    maxRetries: 0,
  }).then(
    () => null,
    (error: unknown) => error,
  );
}

/**
 * 실제 업체 체인(AiSdkGeneratorAdapter)을 메모리 계량기·기록용 경보로 조립한다.
 * 회로 레지스트리를 새로 만들므로 생성기마다 회로 상태가 따로다.
 */
export function createAiSdkGenerator(
  config: AiAssistanceGenerationConfig,
  adapters: readonly AiProviderAdapter[],
  options: {
    readonly alert?: RecordingOperationalAlert;
    readonly meter?: UsageMeterPort;
  } = {},
) {
  const alert = options.alert ?? new RecordingOperationalAlert();
  const meter = options.meter ?? new InMemoryUsageMeterAdapter();
  const registry = new OutboundPolicyRegistry(alert);
  const generator = new AiSdkGeneratorAdapter(
    config,
    new AiProviderCatalog(adapters),
    registry,
    new AiSpendBudgetAdapter(config, meter, alert, new DateClock()),
    alert,
  );
  return { generator, alert, meter, registry };
}
