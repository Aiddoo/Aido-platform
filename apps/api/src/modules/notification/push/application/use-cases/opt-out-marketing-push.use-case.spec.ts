import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { StubMarketingPushOptOutToken } from "#test/doubles/notification/stub-marketing-push-opt-out-token";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type { UserNotificationSettingsPort } from "../ports/user-notification-settings.port.js";
import { OptOutMarketingPushUseCase } from "./opt-out-marketing-push.use-case.js";

const NOW = Temporal.Instant.from("2026-11-10T03:00:00Z");

class RecordingMarketingConsent implements Pick<
  UserNotificationSettingsPort,
  "updateMarketingPushConsent"
> {
  readonly consents = new Map<string, boolean>();

  async updateMarketingPushConsent(user: UserId, agreed: boolean): Promise<void> {
    const userId = user.value;
    this.consents.set(userId, agreed);
  }
}

function setup() {
  const tokens = new StubMarketingPushOptOutToken();
  const settings = new RecordingMarketingConsent();
  const useCase = new OptOutMarketingPushUseCase({
    tokens,
    settings,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { useCase, tokens, settings };
}

describe("OptOutMarketingPushUseCase — 광고성 푸시 수신 철회", () => {
  it("유효한 토큰이면 마케팅 푸시 동의를 false로 갱신하고 true를 반환한다", async () => {
    // Given
    const { useCase, tokens, settings } = setup();
    tokens.register("valid-token", "user-1");

    // When
    const result = await useCase.execute("valid-token");

    // Then
    expect(result).toEqual({ isOptedOut: true, processedAt: new Date(NOW.epochMilliseconds) });
    expect([...settings.consents]).toEqual([["user-1", false]]);
  });

  it("토큰 검증 실패(null)면 설정을 변경하지 않고 처리 시각과 false를 반환한다", async () => {
    // Given
    const { useCase, settings } = setup();

    // When
    const result = await useCase.execute("invalid-token");

    // Then
    expect(result).toEqual({ isOptedOut: false, processedAt: new Date(NOW.epochMilliseconds) });
    expect(settings.consents.size).toBe(0);
  });
});
