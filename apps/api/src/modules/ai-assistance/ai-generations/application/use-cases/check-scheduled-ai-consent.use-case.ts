import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { canShareWithAi } from "../../../shared/domain/ai-data-sharing-consent.domain-service.js";
import type { AiClientAppVersionReaderPort } from "../ports/client-app-version.reader.port.js";
import type { ScheduledAiConsentReadModel } from "../read-models/scheduled-ai-consent.read-model.js";

interface CheckScheduledAiConsentDependencies {
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "getAiDataSharingConsent">;
  readonly clientAppVersion: Pick<AiClientAppVersionReaderPort, "findLatestAppVersion">;
  readonly clock: ClockPort;
}

// 예약 작업(리포트 요약·반복 제안)은 요청 헤더가 없어 푸시 기기·인증 요청에 남은 가장 높은 앱 버전으로 동의 필요 여부를 정한다
export class CheckScheduledAiConsentUseCase {
  readonly #dependencies: CheckScheduledAiConsentDependencies;

  constructor(dependencies: CheckScheduledAiConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: UserId): Promise<ScheduledAiConsentReadModel> {
    const { consentReader, clientAppVersion, clock } = this.#dependencies;
    const [consent, appVersion] = await Promise.all([
      consentReader.getAiDataSharingConsent(userId),
      clientAppVersion.findLatestAppVersion(userId),
    ]);
    return {
      allowed: canShareWithAi({ consent, appVersion, now: clock.now() }),
      agreedVersion: consent.status().agreedVersion,
    };
  }
}
