import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";

/** 예약 작업이 AI로 보내도 되는지와, 보낼 때 처리 업체 범위를 정하는 동의 버전 */
export interface ScheduledAiConsentReadModel {
  readonly allowed: boolean;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}
