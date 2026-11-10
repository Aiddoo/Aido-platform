import type { AiDataSharingConsentStatus } from "../../domain/ai-data-sharing-consent.entity.js";
import type { AiDataSharingConsentReaderPort } from "../ports/ai-data-sharing-consent.reader.port.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";

interface GetAiDataSharingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findAiDataSharingConsent">;
}

/** AI 기능을 가진 Context가 동의 테이블을 직접 읽지 않고 쓰는 동의 상태 */
export class GetAiDataSharingConsentUseCase implements AiDataSharingConsentReaderPort {
  readonly #dependencies: GetAiDataSharingConsentDependencies;

  constructor(dependencies: GetAiDataSharingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsentStatus> {
    const consent = await this.#dependencies.consentRepository.findAiDataSharingConsent(userId);
    return consent.status();
  }
}
