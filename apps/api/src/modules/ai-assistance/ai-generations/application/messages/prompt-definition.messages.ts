import type { SupportedLocale } from "#api/shared/domain/locale";

import type { AiGenerationMeta } from "../../domain/ai-generation.aggregate.js";
import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";
import type {
  AiGenerationRequest,
  AiGeneratorPort,
  AiTaskId,
  AiTaskOutputs,
} from "../ports/ai-generator.port.js";
import { type UntrustedTag, wrapUntrusted } from "./untrusted-input.messages.js";

/** system은 사용자 값이 없는 고정 지시라 업체 어댑터가 캐시를 건다. prompt는 동적 맥락과 입력이다. */
export interface BuiltPrompt {
  readonly system: string;
  readonly prompt: string;
}

/** 지시·정규화가 바뀌면 숫자를 올린다. 관측 로그와 저장된 리포트가 이 값으로 전후를 나눈다. */
type PromptVersion<TTask extends AiTaskId> = `${TTask}@${number}`;

/**
 * 작업 하나의 프롬프트 정의. 모델 출력(작업의 업체 중립 모양)과 서버 정규화 결과(R)를 한 쌍으로 묶는다.
 * C는 정규화에 필요한 서버 값(소유 카테고리 id 등)이고 기본은 build 입력과 같다.
 */
export interface PromptDefinition<TTask extends AiTaskId, I, R, C = I> {
  readonly id: TTask;
  readonly version: PromptVersion<TTask>;
  readonly taskClass: AiTaskClass;
  /** build가 만드는 user 턴의 글자 상한(계약 길이·맥락 상한 최대치에 여유를 둔 값). 비용 방어선이다. */
  readonly maxInputChars: number;
  build(input: I, locale: SupportedLocale): BuiltPrompt;
  normalize(raw: AiTaskOutputs[TTask], context: C): R;
}

export interface PromptGeneration<R> {
  readonly value: R;
  readonly meta: AiGenerationMeta;
}

export interface PromptGenerationRequest<C> extends Pick<
  AiGenerationRequest<AiTaskId>,
  "agreedConsentVersion" | "signal" | "userId"
> {
  readonly built: BuiltPrompt;
  readonly context: C;
}

/** 정의의 작업 id·버전·분류·입력 상한으로 생성기를 부르고 출력을 정규화한다. */
export async function generateWithPrompt<TTask extends AiTaskId, I, R, C>(
  generator: Pick<AiGeneratorPort, "generate">,
  definition: PromptDefinition<TTask, I, R, C>,
  request: PromptGenerationRequest<C>,
): Promise<PromptGeneration<R>> {
  const { built, context, ...options } = request;
  const generation = await generator.generate({
    task: definition.id,
    taskClass: definition.taskClass,
    maxInputChars: definition.maxInputChars,
    promptVersion: definition.version,
    system: built.system,
    prompt: built.prompt,
    ...options,
  });
  return { value: definition.normalize(generation.output, context), meta: generation.meta };
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

/** 예시 입력은 실제 user 턴과 같은 인코더로 만들어 데이터 블록 모양이 어긋나지 않게 한다. */
export function renderExample(tag: UntrustedTag, input: unknown, output: unknown): string {
  return `<example>\n${wrapUntrusted(tag, input)}\n<output>${JSON.stringify(output)}</output>\n</example>`;
}

/** user 턴: 동적 맥락을 먼저, 신뢰할 수 없는 사용자 입력 블록을 맨 끝에 둔다. */
export function composeUserTurn(input: { readonly context?: string; readonly input: string }) {
  return input.context == null ? input.input : `${input.context}\n${input.input}`;
}
