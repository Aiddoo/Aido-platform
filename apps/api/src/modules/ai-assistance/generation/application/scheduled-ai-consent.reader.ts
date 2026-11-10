import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";

import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { canShareWithAi } from "../../shared/domain/ai-data-sharing-consent.domain-service.js";
import type { AiClientAppVersionReaderPort } from "./ports/client-app-version.reader.port.js";

interface ScheduledAiConsentReaderDependencies {
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "findAiDataSharingConsent">;
  readonly clientAppVersion: Pick<AiClientAppVersionReaderPort, "findLatestAppVersion">;
  readonly clock: ClockPort;
}

/** 예약 작업이 AI로 보내도 되는지와, 보낼 때 처리 업체 범위를 정하는 동의 버전 */
export interface ScheduledAiConsent {
  readonly allowed: boolean;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}

/**
 * 예약 작업(리포트 요약·반복 제안)이 사용자 데이터를 AI로 보내도 되는지 실행 시점에 다시 확인한다.
 * 요청 헤더가 없으므로 푸시 기기·인증 요청에 남은 가장 높은 앱 버전으로 동의가 필요한지 정한다.
 */
export class ScheduledAiConsentReader {
  readonly #dependencies: ScheduledAiConsentReaderDependencies;

  constructor(dependencies: ScheduledAiConsentReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async find(userId: string): Promise<ScheduledAiConsent> {
    const { consentReader, clientAppVersion, clock } = this.#dependencies;
    const [consent, appVersion] = await Promise.all([
      consentReader.findAiDataSharingConsent(userId),
      clientAppVersion.findLatestAppVersion(UserId.reconstitute(userId)),
    ]);
    return {
      allowed: canShareWithAi({ consent, appVersion, now: clock.now() }),
      agreedVersion: consent.status().agreedVersion,
    };
  }
}
