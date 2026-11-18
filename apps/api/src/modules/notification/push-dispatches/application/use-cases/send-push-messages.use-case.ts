import { PUSH_CHANNELS } from "../../../shared/domain/push-channel.constants.js";
import type { PushChannelRegistryPort } from "../ports/push-channel-registry.port.js";
import type { PushMessage, PushSendResult } from "../ports/push-channel.port.js";
import {
  pushChannelResultCountMismatch,
  pushMessageResultMissing,
} from "../push-dispatches.errors.js";

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
      // 호출자가 결과를 발송에 위치로 잇기 때문에 하나라도 빠지면 뒤 결과가 다른 발송에 기록된다
      if (results.length !== entries.length) {
        throw pushChannelResultCountMismatch(channel, entries.length, results.length);
      }
      for (const [position, result] of results.entries()) {
        const entry = entries[position];
        if (entry != null) {
          resultsByIndex.set(entry[0], result);
        }
      }
    }
    return messages.map((message, index) => {
      const result = resultsByIndex.get(index);
      if (result == null) {
        throw pushMessageResultMissing(index, message.channel);
      }
      return result;
    });
  }
}
