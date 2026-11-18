import {
  FakePushChannel,
  pushChannelRegistryOf,
} from "#test/doubles/notification/fake-push-channel";

import { PushTicketId } from "../../domain/push-ticket-id.vo.js";
import type { PushMessage } from "../ports/push-channel.port.js";
import { SendPushMessagesUseCase } from "./send-push-messages.use-case.js";

function message(token: string): PushMessage {
  return {
    channel: "EXPO",
    token,
    title: "title",
    body: "body",
    priority: "high",
    ttlSeconds: 3600,
  };
}

describe("SendPushMessagesUseCase", () => {
  it("메시지를 토큰의 채널 구현으로 보내고 결과를 입력 순서로 돌려준다", async () => {
    // Given
    const expo = new FakePushChannel();
    expo.nextResults = async (messages) =>
      messages.map((sent) =>
        sent.token === "tablet"
          ? { token: sent.token, status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } }
          : {
              token: sent.token,
              status: "accepted",
              ticketId: PushTicketId.reconstitute(`ticket-${sent.token}`),
            },
      );
    const useCase = new SendPushMessagesUseCase({ channels: pushChannelRegistryOf(expo) });

    // When
    const results = await useCase.execute([message("phone"), message("tablet"), message("mac")]);

    // Then
    expect(expo.sentBatches).toEqual([[message("phone"), message("tablet"), message("mac")]]);
    expect(results.map((result) => [result.token, result.status])).toEqual([
      ["phone", "accepted"],
      ["tablet", "rejected"],
      ["mac", "accepted"],
    ]);
  });

  it("보낼 메시지가 없으면 채널을 부르지 않는다", async () => {
    // Given
    const expo = new FakePushChannel();
    const useCase = new SendPushMessagesUseCase({ channels: pushChannelRegistryOf(expo) });

    // When
    const results = await useCase.execute([]);

    // Then
    expect(results).toEqual([]);
    expect(expo.sentBatches).toEqual([]);
  });
});
