import type { UpdateAiDataSharingConsentResponse } from "@aido/api";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";

import { resolveAiDataSharingAgreement } from "../../../domain/services/settings/ai-data-sharing-consent-policy.js";
import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import type { UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { buildAiDataSharingConsentView } from "../../read-models/settings/consent.read-model.js";

export interface UpdateAiDataSharingConsentInput {
  readonly userId: string;
  readonly agreed: boolean;
  /** 사용자가 읽고 답한 안내 버전. 요청 검증이 현재 버전만 받는다. */
  readonly version: string;
}

interface UpdateAiDataSharingConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "upsertAiDataSharingConsent">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/** AI 데이터 처리(Google Gemini 전송)에 동의하거나 거부·철회한다. 거부해도 AI 외 기능은 그대로다. */
export class UpdateAiDataSharingConsent {
  readonly #dependencies: UpdateAiDataSharingConsentDependencies;

  constructor(dependencies: UpdateAiDataSharingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: UpdateAiDataSharingConsentInput,
  ): Promise<UpdateAiDataSharingConsentResponse> {
    const updated = await this.#dependencies.consentRepository.upsertAiDataSharingConsent(
      input.userId,
      { agreedAt: resolveAiDataSharingAgreement(input.agreed, now()), version: input.version },
    );
    this.#dependencies.logger.log({
      event: IdentitySettingsLogEvent.AI_DATA_SHARING_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
      version: input.version,
    });
    return buildAiDataSharingConsentView(updated, input.version);
  }
}
