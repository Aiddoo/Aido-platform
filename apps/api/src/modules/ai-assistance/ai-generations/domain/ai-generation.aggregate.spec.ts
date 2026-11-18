import { ErrorCode } from "@aido/api/errors";

import { AiGeneration, type CreateAiGenerationParams } from "./ai-generation.aggregate.js";

function generationParams(
  overrides: Partial<CreateAiGenerationParams<{ readonly title: string }>> = {},
): CreateAiGenerationParams<{ readonly title: string }> {
  return {
    output: { title: "운동" },
    route: ["anthropic", "google"],
    provider: "anthropic",
    model: "anthropic:claude-haiku-5-5",
    attempts: 1,
    latencyMs: 800,
    inputTokens: 150,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 50,
    reasoningTokens: 0,
    estimatedCostMicroUsd: 120,
    finishReason: "stop",
    ...overrides,
  };
}

describe("AiGeneration", () => {
  it.each([
    ["응답한 업체가 시도 경로에 없으면", { route: ["google"], provider: "anthropic" }],
    ["시도 횟수가 0이면", { attempts: 0 }],
    ["시도 횟수가 정수가 아니면", { attempts: 1.5 }],
    ["추정 비용이 음수면", { estimatedCostMicroUsd: -1 }],
  ] as const)("%s 만들지 않는다", (_title, overrides) => {
    // When
    const create = () => AiGeneration.create(generationParams(overrides));

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0001 }));
  });

  it("단가를 모르는 모델이면 비용을 null로 두고 만든다", () => {
    // When
    const generation = AiGeneration.create(generationParams({ estimatedCostMicroUsd: null }));

    // Then
    expect(generation.estimatedCostMicroUsd).toBeNull();
  });

  it.each([
    ["첫 업체가 바로 답하면 넘어온 업체가 없다", { provider: "anthropic", attempts: 1 }, null],
    [
      "첫 업체를 다시 불러 답을 받아도 넘어온 업체가 없다",
      { provider: "anthropic", attempts: 2 },
      null,
    ],
    [
      "다른 업체가 답하면 경로의 첫 업체에서 넘어왔다",
      { provider: "google", attempts: 2 },
      "anthropic",
    ],
  ] as const)("%s", (_title, overrides, fallbackFrom) => {
    // When
    const generation = AiGeneration.create(generationParams(overrides));

    // Then
    expect(generation.fallbackFrom).toBe(fallbackFrom);
  });
});
