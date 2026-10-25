import { ConfigService } from "@nestjs/config";

import { readAiModelIds, readAiTaskSettings } from "./ai-task-config.js";

describe("AI 작업 설정", () => {
  it("env가 없으면 모든 작업에 기본 모델과 low thinking을 쓴다", () => {
    // Given
    const config = new ConfigService({});
    // When
    const models = readAiModelIds(config);
    const settings = readAiTaskSettings(config);
    // Then
    expect(Object.values(models)).toEqual(Array(4).fill("gemini-3.1-flash-lite"));
    expect(settings.report).toEqual({ thinking: "low" });
  });

  it("작업별 env는 해당 작업의 모델과 thinking만 바꾼다", () => {
    // Given
    const config = new ConfigService({
      AI_MODEL_PARSE_TODO: "gemini-3.5-flash-lite",
      AI_THINKING_PARSE_TODO: "minimal",
    });
    // When
    const models = readAiModelIds(config);
    const settings = readAiTaskSettings(config);
    // Then
    expect(models["parse-todo"]).toBe("gemini-3.5-flash-lite");
    expect(models["parse-memo"]).toBe("gemini-3.1-flash-lite");
    expect(settings["parse-todo"].thinking).toBe("minimal");
    expect(settings.suggestion.thinking).toBe("low");
  });

  it("지원하지 않는 thinking 값은 부팅 단계에서 거절한다", () => {
    // Given
    const config = new ConfigService({ AI_THINKING_REPORT: "high" });
    // When / Then
    expect(() => readAiTaskSettings(config)).toThrow();
  });
});
