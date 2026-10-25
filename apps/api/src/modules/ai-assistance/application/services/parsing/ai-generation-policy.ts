import type { AiGenerationPolicy, AiTaskId } from "../../ports/parsing/ai-provider.port.js";
import type { AiTaskSettings } from "../../ports/parsing/ai-task-settings.port.js";

type BasePolicy = Omit<AiGenerationPolicy, "thinking">;

/**
 * 작업별 생성 상한. 사고 토큰이 maxOutputTokens에 포함되므로 실제 출력보다 넉넉히 둔다.
 * 비용은 실제 생성량에만 비례하고, 잘린 출력은 TRUNCATED로 분류된다.
 */
const BASE_POLICIES: Readonly<Record<AiTaskId, BasePolicy>> = {
  "parse-todo": { maxOutputTokens: 1024, timeoutMs: 12_000, maxRetries: 1 },
  "parse-memo": { maxOutputTokens: 4096, timeoutMs: 25_000, maxRetries: 1 },
  // 리포트·제안은 잡 재시도가 따로 있어 SDK 재시도는 짧게 유지한다.
  report: { maxOutputTokens: 2048, timeoutMs: 60_000, maxRetries: 2 },
  suggestion: { maxOutputTokens: 2048, timeoutMs: 60_000, maxRetries: 2 },
};

export function resolveGenerationPolicy(
  task: AiTaskId,
  settings: Pick<AiTaskSettings, "thinking">,
): AiGenerationPolicy {
  return { ...BASE_POLICIES[task], thinking: settings.thinking };
}
