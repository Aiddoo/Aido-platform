import type { SupportedLocale } from "@aido/api/vocabulary";

import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { PushPayload } from "./push-provider.port.js";

export interface CreatePushNotificationPayloadInput {
  readonly data: CreateNotificationData;
  readonly notificationId: number;
  readonly dispatchId: number;
  /** 받는 사람 언어. 광고성 표기 문구에 쓴다. */
  readonly locale: SupportedLocale;
  /** 발송 판단이 받는 사람 시간대로 정한 공급자 보관 시간(초) */
  readonly ttlSeconds: number;
}

export interface BatchPushNotificationPayload extends Omit<PushPayload, "token"> {
  readonly userId: string;
  readonly dispatchId: number;
  readonly requiresFeatureCapability: boolean;
  /** 이 버전 미만 기기에는 보내지 않는다. 없으면 모든 활성 기기 대상이다. */
  readonly minAppVersion?: string;
}

// 푸시 data는 앱 계약 모양이라 계약 검증을 아는 바깥 매퍼가 만든다
export abstract class PushNotificationPayloadPort {
  abstract createSingle(input: CreatePushNotificationPayloadInput): Omit<PushPayload, "token">;
  abstract createBatch(input: CreatePushNotificationPayloadInput): BatchPushNotificationPayload;
}
