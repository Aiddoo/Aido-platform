import { ErrorCode } from "@aido/api/errors";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Suggestion } from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";

/**
 * 대기 중인 제안 목록 조회 use-case.
 *
 * 프리미엄 접근을 강제한 뒤 PENDING·미만료 제안을 조회한다.
 */
interface GetPendingSuggestionsDependencies {
  readonly repository: AiSuggestionRepositoryPort;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccess">;
  readonly logger: ApplicationLogger;
}

export class GetPendingSuggestions {
  readonly #dependencies: GetPendingSuggestionsDependencies;

  constructor(dependencies: GetPendingSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<Suggestion[]> {
    const hasPremium = await this.#dependencies.entitlementReader.hasPremiumAccess(userId);
    if (!hasPremium) {
      this.#dependencies.logger.warn(`프리미엄 미구독 접근 차단: userId=${userId}`);
      throw new ApplicationException(ErrorCode.AI_1309);
    }

    return this.#dependencies.repository.findPendingByUserId(userId);
  }
}
