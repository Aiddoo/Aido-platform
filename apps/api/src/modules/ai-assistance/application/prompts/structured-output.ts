import type { z } from "zod";

import type {
  AiGenerationMeta,
  AiGenerationRequest,
  AiGeneratorPort,
} from "../ports/generation/ai-generator.port.js";

export interface BuiltPrompt {
  readonly system: string;
  readonly prompt: string;
}

export type StructuredRequest = Omit<AiGenerationRequest<unknown>, "schema">;

export type GenerationMeta = AiGenerationMeta;

export interface StructuredGeneration<R> {
  readonly value: R;
  readonly meta: GenerationMeta;
}

/**
 * 버전마다 다른 LLM 출력 schema와 서버 정규화를 한 쌍으로 묶는다.
 * 호출부는 버전별 출력 타입을 몰라도 같은 정규화 결과 R만 받는다.
 */
export interface StructuredOutput<R, C> {
  generate(
    generator: Pick<AiGeneratorPort, "generate">,
    request: StructuredRequest,
    context: C,
  ): Promise<StructuredGeneration<R>>;
}

export function structuredOutput<T, R, C>(
  schema: z.ZodType<T>,
  normalize: (output: T, context: C) => R,
): StructuredOutput<R, C> {
  return {
    async generate(generator, request, context) {
      const { output, ...meta } = await generator.generate({ ...request, schema });
      return { value: normalize(output, context), meta };
    },
  };
}
