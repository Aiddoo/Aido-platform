import { PUSH_CHANNELS } from "../../../shared/domain/push-channel.constants.js";
import type { PushChannelRegistryPort } from "../ports/push-channel-registry.port.js";
import type { PushMessage, PushSendResult } from "../ports/push-channel.port.js";

interface SendPushMessagesDependencies {
  readonly channels: Pick<PushChannelRegistryPort, "forChannel">;
}

// 메시지를 토큰의 채널마다 나눠 보내고 결과를 입력 순서로 모은다
export class SendPushMessagesUseCase {
  readonly #dependencies: SendPushMessagesDependencies;

  constructor(dependencies: SendPushMessagesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(messages: readonly PushMessage[]): Promise<PushSendResult[]> {
    const resultsByIndex = new Map<number, PushSendResult>();
    for (const channel of PUSH_CHANNELS) {
      const entries = [...messages.entries()].filter(([, message]) => message.channel === channel);
      if (entries.length === 0) {
        continue;
      }
      const results = await this.#dependencies.channels
        .forChannel(channel)
        .sendBatch(entries.map(([, message]) => message));
      for (const [position, result] of results.entries()) {
        const entry = entries[position];
        if (entry != null) {
          resultsByIndex.set(entry[0], result);
        }
      }
    }
    return messages.flatMap((_, index) => {
      const result = resultsByIndex.get(index);
      return result == null ? [] : [result];
    });
  }
}
