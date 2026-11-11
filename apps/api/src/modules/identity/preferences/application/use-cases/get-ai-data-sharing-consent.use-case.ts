import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";
import type { AiDataSharingConsentReaderPort } from "../ports/ai-data-sharing-consent.reader.port.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";

interface GetAiDataSharingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findAiDataSharingConsent">;
}

/** AI 기능을 가진 Context가 동의 테이블을 직접 읽지 않고 쓰는 동의 */
export class GetAiDataSharingConsentUseCase implements AiDataSharingConsentReaderPort {
  readonly #dependencies: GetAiDataSharingConsentDependencies;

  constructor(dependencies: GetAiDataSharingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent> {
    return this.#dependencies.consentRepository.findAiDataSharingConsent(userId);
  }
}
