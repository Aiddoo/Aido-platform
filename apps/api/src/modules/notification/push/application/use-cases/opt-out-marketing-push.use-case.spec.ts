import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  createMarketingPushOptOutTokenMock,
  createUserNotificationSettingsMock,
} from "#test/mocks/ports/notification.mock";

import { OptOutMarketingPushUseCase } from "./opt-out-marketing-push.use-case.js";

describe("OptOutMarketingPushUseCase", () => {
  let useCase: OptOutMarketingPushUseCase;
  let tokens: Mocked<ConstructorParameters<typeof OptOutMarketingPushUseCase>[0]["tokens"]>;
  let settings: Mocked<ConstructorParameters<typeof OptOutMarketingPushUseCase>[0]["settings"]>;

  beforeEach(async () => {
    const optOutMarketingPushDependencies = mockDeep<
      ConstructorParameters<typeof OptOutMarketingPushUseCase>[0]
    >({
      tokens: createMarketingPushOptOutTokenMock(),
      settings: createUserNotificationSettingsMock(),
    });
    const unit = new OptOutMarketingPushUseCase(optOutMarketingPushDependencies);
    useCase = unit;
    tokens = optOutMarketingPushDependencies.tokens;
    settings = optOutMarketingPushDependencies.settings;
  });

  it("유효한 토큰이면 마케팅 푸시 동의를 false로 갱신하고 true를 반환한다", async () => {
    tokens.verify.mockReturnValue("user-1");

    const result = await useCase.execute("valid-token");

    expect(result.isOptedOut).toBe(true);
    expect(result.processedAt).toBeInstanceOf(Date);
    expect(tokens.verify).toHaveBeenCalledWith("valid-token");
    expect(settings.updateMarketingPushConsent).toHaveBeenCalledWith("user-1", false);
  });

  it("토큰 검증 실패(null)면 설정을 변경하지 않고 false를 반환한다", async () => {
    tokens.verify.mockReturnValue(null);

    const result = await useCase.execute("invalid-token");

    expect(result.isOptedOut).toBe(false);
    expect(result.processedAt).toBeInstanceOf(Date);
    expect(settings.updateMarketingPushConsent).not.toHaveBeenCalled();
  });
});
