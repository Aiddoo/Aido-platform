import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiDataSharingConsentReaderPort } from "../../application/ports/ai-data-sharing-consent.reader.port.js";
import { GetAiDataSharingConsentUseCase } from "../../application/use-cases/get-ai-data-sharing-consent.use-case.js";
import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";

@Injectable()
export class AiDataSharingConsentReaderAdapter extends AiDataSharingConsentReaderPort {
  readonly #getAiDataSharingConsent: Pick<GetAiDataSharingConsentUseCase, "execute">;

  constructor(getAiDataSharingConsent: GetAiDataSharingConsentUseCase) {
    super();
    this.#getAiDataSharingConsent = getAiDataSharingConsent;
  }

  getAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent> {
    return this.#getAiDataSharingConsent.execute(userId);
  }
}
