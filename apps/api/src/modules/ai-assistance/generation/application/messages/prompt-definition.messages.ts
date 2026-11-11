import type { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";
import type {
  AiGenerationMeta,
  AiGenerationRequest,
  AiGeneratorPort,
  AiTaskId,
} from "../ports/ai-generator.port.js";

/** system은 사용자 값이 없는 고정 지시라 업체 어댑터가 캐시를 건다. prompt는 동적 맥락과 입력이다. */
export interface BuiltPrompt {
  readonly system: string;
  readonly prompt: string;
}

/** 지시·정규화가 바뀌면 숫자를 올린다. 관측 로그와 저장된 리포트가 이 값으로 전후를 나눈다. */
type PromptVersion = `${AiTaskId}@${number}`;

/**
 * 작업 하나의 프롬프트 정의. 모델 출력 schema(O, 관대)와 서버 정규화 결과(R)를 한 쌍으로 묶는다.
 * C는 정규화에 필요한 서버 값(소유 카테고리 id 등)이고 기본은 build 입력과 같다.
 */
export interface PromptDefinition<I, O, R, C = I> {
  readonly id: AiTaskId;
  readonly version: PromptVersion;
  readonly taskClass: AiTaskClass;
  /** build가 만드는 user 턴의 글자 상한(계약 길이·맥락 상한 최대치에 여유를 둔 값). 비용 방어선이다. */
  readonly maxInputChars: number;
  readonly schema: z.ZodType<O>;
  build(input: I, locale: SupportedLocale): BuiltPrompt;
  normalize(raw: O, context: C): R;
}

export interface PromptGeneration<R> {
  readonly value: R;
  readonly meta: AiGenerationMeta;
}

export type PromptGenerationOptions = Pick<
  AiGenerationRequest<unknown>,
  "agreedConsentVersion" | "signal" | "userId"
>;

/** 정의의 작업 id·버전·분류·입력 상한·schema로 생성기를 부르고 출력을 정규화한다. */
export async function generateWithPrompt<I, O, R, C>(
  generator: Pick<AiGeneratorPort, "generate">,
  definition: PromptDefinition<I, O, R, C>,
  built: BuiltPrompt,
  context: C,
  options: PromptGenerationOptions,
): Promise<PromptGeneration<R>> {
  const { output, ...meta } = await generator.generate({
    task: definition.id,
    taskClass: definition.taskClass,
    maxInputChars: definition.maxInputChars,
    promptVersion: definition.version,
    system: built.system,
    prompt: built.prompt,
    schema: definition.schema,
    ...options,
  });
  return { value: definition.normalize(output, context), meta };
}

/** 고정 system의 블록. security·languagePolicy는 kit가 만든 블록, rules는 작업별 태그 블록이다. */
export interface SystemSections {
  readonly role: string;
  readonly security: string;
  readonly languagePolicy: string;
  readonly outputContract: string;
  readonly rules: readonly string[];
  readonly examples: string;
}

const renderBlock = (tag: string, body: string) => `<${tag}>\n${body.trim()}\n</${tag}>`;

/** 캐시 친화 순서: role → security → language_policy → output_contract → rules → examples. */
export function composeSystem(sections: SystemSections): string {
  return [
    renderBlock("role", sections.role),
    sections.security,
    sections.languagePolicy,
    renderBlock("output_contract", sections.outputContract),
    renderBlock("rules", sections.rules.join("\n\n")),
    renderBlock("examples", sections.examples),
  ].join("\n\n");
}

/** user 턴: 동적 맥락을 먼저, 신뢰할 수 없는 사용자 입력 블록을 맨 끝에 둔다. */
export function composeUserTurn(input: { readonly context?: string; readonly input: string }) {
  return input.context == null ? input.input : `${input.context}\n${input.input}`;
}
