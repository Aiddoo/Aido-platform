import type { z } from "zod";

import type { PlanResultReplay } from "./plan-result-replay.port.js";

// 빠른 계획·녹음 정리가 한 메모리 상한을 나눠 쓰도록 이름공간별 재생 저장소를 한 곳에서 만든다
export abstract class PlanResultReplayFactoryPort {
  abstract forNamespace<TResult>(
    namespace: string,
    schema: z.ZodType<TResult>,
  ): PlanResultReplay<TResult>;
}
