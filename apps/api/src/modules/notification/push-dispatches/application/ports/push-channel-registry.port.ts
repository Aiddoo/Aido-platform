import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";
import type { PushChannelPort } from "./push-channel.port.js";

// 토큰의 채널로 보낼 Strategy를 고른다. PUSH_CHANNELS의 모든 채널에 구현이 있다
export abstract class PushChannelRegistryPort {
  abstract forChannel(channel: PushChannel): PushChannelPort;
}
