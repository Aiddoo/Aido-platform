import { ConfigService } from "@nestjs/config";

import { readAiModelIds, readAiTaskSettings } from "./ai-task-config.js";

describe("AI 작업 설정", () => {
  it("env가 없으면 모든 작업에 기본 모델을 쓰고 parse-todo만 minimal, 나머지는 low thinking이다", () => {
    // Given
    const config = new ConfigService({});
    // When
    const models = readAiModelIds(config);
    const settings = readAiTaskSettings(config);
    // Then
    expect(Object.values(models)).toEqual(Array(4).fill("gemini-3.1-flash-lite"));
    expect(settings["parse-todo"]).toEqual({ promptVersion: "v2", thinking: "minimal" });
    expect(settings["parse-memo"].thinking).toBe("low");
    expect(settings.report).toEqual({ promptVersion: "v2", thinking: "low" });
    expect(settings.suggestion.thinking).toBe("low");
  });

  it("AI_THINKING_PARSE_TODO=low로 parse-todo의 minimal 기본값을 되돌릴 수 있다", () => {
    // Given
    const config = new ConfigService({ AI_THINKING_PARSE_TODO: "low" });
    // When
    const settings = readAiTaskSettings(config);
    // Then
    expect(settings["parse-todo"].thinking).toBe("low");
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

  it("AI_PROMPT_VERSION_<TASK>=v1이면 그 작업만 v1 프롬프트로 되돌린다", () => {
    // Given
    const config = new ConfigService({ AI_PROMPT_VERSION_PARSE_MEMO: "v1" });
    // When
    const settings = readAiTaskSettings(config);
    // Then
    expect(settings["parse-memo"].promptVersion).toBe("v1");
    expect(settings["parse-todo"].promptVersion).toBe("v2");
  });

  it("지원하지 않는 thinking 값은 부팅 단계에서 거절한다", () => {
    // Given
    const config = new ConfigService({ AI_THINKING_REPORT: "high" });
    // When / Then
    expect(() => readAiTaskSettings(config)).toThrow();
  });
});
