import type { SupportedLocale } from "#api/shared/domain/locale";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { PushPayload } from "./push-provider.port.js";

export interface CreatePushNotificationPayloadInput {
  readonly data: CreateNotificationData;
  readonly notificationId: number;
  readonly dispatchId: number;
  /** 받는 사람 언어. 광고성 표기 문구에 쓴다. */
  readonly locale?: SupportedLocale;
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
