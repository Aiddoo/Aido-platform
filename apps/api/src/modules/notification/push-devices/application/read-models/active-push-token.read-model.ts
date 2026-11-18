import type { PushDevicePlatform } from "@aido/api/vocabulary";

import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";

// 발송할 활성 토큰. 채널로 나눠 보내고 기기의 앱 버전·플랫폼으로 실을 값을 고른다
export interface ActivePushTokenReadModel {
  readonly token: string;
  readonly channel: PushChannel;
  readonly platform: PushDevicePlatform;
  readonly appVersion: string | null;
}
