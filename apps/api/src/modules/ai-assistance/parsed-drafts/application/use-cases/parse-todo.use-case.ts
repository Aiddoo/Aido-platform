import type { SupportedLocale } from "@aido/api/vocabulary";

import type { QuotaLedgerPort } from "#api/modules/access/quota-charges/access-quota-charges.public";
import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { describeGenerationFailure } from "../../../ai-generations/application/ai-generation-failure.mapper.js";
import { generationFailed } from "../../../ai-generations/application/ai-generations.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
} from "../../../ai-generations/application/ai-generations.log-events.js";
import { generateWithPrompt } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import type { AiGeneratorPort } from "../../../ai-generations/application/ports/ai-generator.port.js";
import type { UserLocalePreferenceReaderPort } from "../../../ai-generations/application/ports/user-locale-preference.reader.port.js";
import { resolveRequestLocale } from "../../../ai-generations/application/request-locale.mapper.js";
import { parseTodoPrompt } from "../messages/parse-todo-prompt.messages.js";
import { toParseMeta } from "../parse-meta.mapper.js";
import type { ChargedGenerationPort } from "../ports/charged-generation.port.js";
import type { UserCategoryReaderPort } from "../ports/user-category.reader.port.js";
import type { ParsedDraftReadModel } from "../read-models/parsed-draft.read-model.js";

/** 자연어 텍스트를 할 일 하나로 파싱하는 입력. 사용량을 차감하는 쓰기 유스케이스다. */
export interface ParseTodoCommand {
  readonly text: string;
  readonly userId: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
  readonly categoryId: number | undefined;
  /** Accept-Language 헤더가 고른 언어. null이면 저장된 사용자 언어를 쓴다(resolveRequestLocale). */
  readonly requestedLocale: SupportedLocale | null;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  readonly signal?: AbortSignal;
}

interface ResolvedParseTodoCommand extends Omit<ParseTodoCommand, "requestedLocale"> {
  readonly timezone: string;
  readonly locale: SupportedLocale;
}

interface ParseTodoDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "getAiDataSharingConsent">;
  readonly categoryReader: Pick<UserCategoryReaderPort, "findByUserId">;
  readonly quota: Pick<QuotaLedgerPort, "reserve">;
  readonly chargedGeneration: Pick<ChargedGenerationPort, "settle">;
  readonly clock: ClockPort;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn" | "error">;
}

/**
 * 사용량 원자적 예약 → 프롬프트 조립 → 동의 범위 안의 업체로 AI 생성 → 정규화.
 * 생성 실패 시 예약을 한 번 환불하고, 실패 종류에 따라 요청 과다(AI_1310)/호출 실패(AI_1301)/
 * 할 일 만들기 실패(AI_1302)를 details.charged=false와 함께 던진다. 실행할 행동이 없던 입력은 차감하지 않는다.
 */
export class ParseTodoUseCase {
  readonly #dependencies: ParseTodoDependencies;

  constructor(dependencies: ParseTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ParseTodoCommand): Promise<ParsedDraftReadModel> {
    const owner = UserId.reconstitute(command.userId);
    const startTime = this.#dependencies.clock.now().epochMilliseconds;

    const { timezone, locale } = await resolveRequestLocale(
      this.#dependencies.localePreferenceReader,
      owner,
      command,
    );
    const reservation = await this.#dependencies.quota.reserve({
      userId: owner,
      feature: "AI_PARSE",
      idempotencyKey: null,
      reason: "parse-todo",
    });
    const { result, featureQuota } = await this.#dependencies.chargedGeneration.settle({
      reservation,
      userId: owner,
      feature: "AI_PARSE",
      task: parseTodoPrompt.id,
      generate: async () => {
        const parsed = await this.#parse({ ...command, timezone, locale }, startTime);
        return { result: parsed, outcome: parsed.draft.hasAction() ? "CHARGE" : "NO_ACTION" };
      },
    });
    return { ...result, featureQuota };
  }

  async #parse(
    command: ResolvedParseTodoCommand,
    startTime: number,
  ): Promise<Omit<ParsedDraftReadModel, "featureQuota">> {
    const { text, userId, timezone, categoryId, locale } = command;
    const owner = UserId.reconstitute(userId);
    const definition = parseTodoPrompt;
    const at = instantToDate(this.#dependencies.clock.now());

    // 사용자가 카테고리를 고른 요청은 목록을 보내지 않아 토큰을 아낀다.
    const userCategories =
      categoryId == null ? await this.#dependencies.categoryReader.findByUserId(owner) : [];
    const built = definition.build({ text, timezone, now: at, categories: userCategories }, locale);
    const logBase = { task: definition.id, promptVersion: definition.version, userId } as const;

    const consent = await this.#dependencies.consentReader.getAiDataSharingConsent(owner);
    const { agreedVersion } = consent.status();
    try {
      const { value, meta } = await generateWithPrompt(this.#dependencies.generator, definition, {
        built,
        context: {
          text,
          timezone,
          now: at,
          locale,
          ownedCategoryIds: new Set(userCategories.map((category) => category.id)),
          requestedCategoryId: categoryId,
        },
        agreedConsentVersion: agreedVersion,
        userId: owner,
        signal: command.signal,
      });
      const charge = value.draft.hasAction();
      this.#dependencies.logger.log({
        ...buildGenerationCompletedLog(
          { ...logBase, outcome: charge ? "SUCCESS" : "NO_ACTION", quotaCharged: charge },
          meta,
        ),
        warnings: value.warnings,
      });
      const processingTimeMs = this.#dependencies.clock.now().epochMilliseconds - startTime;
      return {
        draft: value.draft,
        meta: toParseMeta(meta, { promptVersion: definition.version, processingTimeMs }),
      };
    } catch (error) {
      const failure = describeGenerationFailure(error);
      this.#dependencies.logger.error(
        buildGenerationFailedLog({
          ...logBase,
          outcome: "FAILED",
          ...failure,
          latencyMs: this.#dependencies.clock.now().epochMilliseconds - startTime,
          quotaCharged: false,
        }),
      );
      throw generationFailed(failure.errorCode, error);
    }
  }
}
