import { PushTokenFormatPort } from "#api/modules/notification/push-devices/application/ports/push-token-format.port";
import type { PushChannel } from "#api/modules/notification/shared/domain/push-channel.constants";

// Expo 토큰 접두어와 테스트용 fake- 토큰만 받는다
export class StubPushTokenFormat extends PushTokenFormatPort {
  accepts(_channel: PushChannel, token: string): boolean {
    return token.startsWith("ExponentPushToken[") || token.startsWith("fake-");
  }
}
