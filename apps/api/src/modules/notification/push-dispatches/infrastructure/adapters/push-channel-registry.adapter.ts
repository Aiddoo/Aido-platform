import { PUSH_CHANNELS, type PushChannel } from "../../../shared/domain/push-channel.constants.js";
import type { PushChannelRegistryPort } from "../../application/ports/push-channel-registry.port.js";
import type { PushChannelPort } from "../../application/ports/push-channel.port.js";

// 채널 구현을 이름으로 찾는다. 빠진 채널이 있으면 첫 발송이 아니라 부팅에서 실패한다
export class PushChannelRegistryAdapter implements PushChannelRegistryPort {
  readonly #channels: ReadonlyMap<PushChannel, PushChannelPort>;

  constructor(channels: readonly PushChannelPort[]) {
    this.#channels = new Map(channels.map((port) => [port.channel, port]));
    const missing = PUSH_CHANNELS.filter((channel) => !this.#channels.has(channel));
    if (missing.length > 0) {
      throw new Error(`Push channel adapters are missing: ${missing.join(", ")}`);
    }
  }

  forChannel(channel: PushChannel): PushChannelPort {
    const port = this.#channels.get(channel);
    if (port == null) {
      throw new Error(`Push channel adapter is missing: ${channel}`);
    }
    return port;
  }
}
