import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";

// 기기가 보고한 토큰이 그 발송 채널이 받는 형식인지 본다. 공급자 SDK는 어댑터에만 둔다
export abstract class PushTokenFormatPort {
  abstract accepts(channel: PushChannel, token: string): boolean;
}
