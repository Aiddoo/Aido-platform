/**
 * OptOutMarketingPushUseCase 단위 테스트
 *
 * - 유효 토큰: userId 검증 → 마케팅 푸시 동의 false로 갱신 + true 반환
 * - 무효 토큰: verify=null → 설정 미변경 + false 반환
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createMarketingPushOptOutTokenMock,
	createUserNotificationSettingsMock,
} from "@test/mocks/ports/notification.mock";
import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../../ports/marketing-push-opt-out-token.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";
import { OptOutMarketingPushUseCase } from "./opt-out-marketing-push.use-case";

describe("OptOutMarketingPushUseCase", () => {
	let useCase: OptOutMarketingPushUseCase;
	let tokens: Mocked<MarketingPushOptOutTokenPort>;
	let settings: Mocked<UserNotificationSettingsPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(OptOutMarketingPushUseCase)
			.mock<MarketingPushOptOutTokenPort>(MARKETING_PUSH_OPT_OUT_TOKEN)
			.impl(() => createMarketingPushOptOutTokenMock())
			.mock<UserNotificationSettingsPort>(USER_NOTIFICATION_SETTINGS)
			.impl(() => createUserNotificationSettingsMock())
			.compile();
		useCase = unit;
		tokens = unitRef.get<MarketingPushOptOutTokenPort>(
			MARKETING_PUSH_OPT_OUT_TOKEN,
		);
		settings = unitRef.get<UserNotificationSettingsPort>(
			USER_NOTIFICATION_SETTINGS,
		);
	});

	it("유효한 토큰이면 마케팅 푸시 동의를 false로 갱신하고 true를 반환한다", async () => {
		tokens.verify.mockReturnValue("user-1");

		const result = await useCase.execute("valid-token");

		expect(result).toBe(true);
		expect(tokens.verify).toHaveBeenCalledWith("valid-token");
		expect(settings.updateMarketingPushConsent).toHaveBeenCalledWith(
			"user-1",
			false,
		);
	});

	it("토큰 검증 실패(null)면 설정을 변경하지 않고 false를 반환한다", async () => {
		tokens.verify.mockReturnValue(null);

		const result = await useCase.execute("invalid-token");

		expect(result).toBe(false);
		expect(settings.updateMarketingPushConsent).not.toHaveBeenCalled();
	});
});
