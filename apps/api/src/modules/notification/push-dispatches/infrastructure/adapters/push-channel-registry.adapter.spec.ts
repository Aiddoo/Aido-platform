import { FakePushChannel } from "#test/doubles/notification/fake-push-channel";

import { PushChannelRegistryAdapter } from "./push-channel-registry.adapter.js";

describe("PushChannelRegistryAdapter", () => {
  it("토큰의 채널로 그 채널 구현을 고른다", () => {
    // Given
    const expo = new FakePushChannel();
    const registry = new PushChannelRegistryAdapter([expo]);

    // When
    const selected = registry.forChannel("EXPO");

    // Then
    expect(selected).toBe(expo);
  });

  it("어휘의 채널 하나라도 구현이 없으면 첫 발송이 아니라 조립에서 실패한다", () => {
    // Given
    const channels: FakePushChannel[] = [];

    // When
    const create = () => new PushChannelRegistryAdapter(channels);

    // Then
    expect(create).toThrow("Push channel adapters are missing: EXPO");
  });
});
