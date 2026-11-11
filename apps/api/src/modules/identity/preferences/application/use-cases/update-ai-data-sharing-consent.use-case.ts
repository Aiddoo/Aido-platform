import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { resolveAiDataSharingAgreement } from "../../domain/ai-data-sharing-consent.domain-service.js";
import type { UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";
import {
  type AiDataSharingConsentView,
  buildAiDataSharingConsentView,
} from "../read-models/consent.read-model.js";

export interface UpdateAiDataSharingConsentCommand {
  readonly userId: string;
  readonly agreed: boolean;
  /** 사용자가 읽고 답한 안내 버전. 요청 검증이 현재 버전만 받는다. */
  readonly version: string;
}

interface UpdateAiDataSharingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertAiDataSharingConsent">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** AI 데이터 처리(Google Gemini 전송)에 동의하거나 거부·철회한다. 거부해도 AI 외 기능은 그대로다. */
export class UpdateAiDataSharingConsentUseCase {
  readonly #dependencies: UpdateAiDataSharingConsentDependencies;

  constructor(dependencies: UpdateAiDataSharingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateAiDataSharingConsentCommand): Promise<AiDataSharingConsentView> {
    const updated = await this.#dependencies.consentRepository.upsertAiDataSharingConsent(
      UserId.reconstitute(input.userId),
      {
        agreedAt: resolveAiDataSharingAgreement(input.agreed, this.#dependencies.clock.now()),
        version: input.version,
      },
    );
    this.#dependencies.logger.log({
      event: PreferenceLogEvent.AI_DATA_SHARING_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
      version: input.version,
    });
    return buildAiDataSharingConsentView(updated, input.version);
  }
}
