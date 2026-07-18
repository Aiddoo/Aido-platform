import {
	isAutomatedEngagementNotification,
	isMarketingNotification,
	isNightExemptNotification,
} from "./push-eligibility";

describe("push eligibility policy", () => {
	it.each([
		"AI_SUGGESTION",
		"WINBACK",
		"SOCIAL_DIGEST",
		"NUDGE_SUGGEST",
		"LUNCH_NUDGE",
		"STREAK_AT_RISK",
	] as const)(
		"%s는 별도 광고성 푸시 동의가 필요한 참여 유도 알림이다",
		(type) => {
			expect(isMarketingNotification(type)).toBe(true);
			expect(isAutomatedEngagementNotification(type)).toBe(true);
		},
	);

	it.each([
		"FOLLOW_NEW",
		"FOLLOW_ACCEPTED",
		"NUDGE_RECEIVED",
		"CHEER_RECEIVED",
		"TODO_REMINDER",
		"TODO_SHARED",
		"MORNING_REMINDER",
		"EVENING_REMINDER",
		"WEEKLY_REPORT",
	] as const)(
		"%s 서비스 알림은 별도 광고성 푸시 동의를 요구하지 않는다",
		(type) => {
			expect(isMarketingNotification(type)).toBe(false);
			expect(isAutomatedEngagementNotification(type)).toBe(false);
		},
	);

	it("사용자 설정 날씨 알림은 광고성 알림이 아니며 야간 설정 예외다", () => {
		expect(isMarketingNotification("WEATHER_MORNING")).toBe(false);
		expect(isNightExemptNotification("WEATHER_MORNING")).toBe(true);
	});

	it("광고성 스트릭 알림은 21:00~08:00 예외가 아니다", () => {
		expect(isNightExemptNotification("STREAK_AT_RISK")).toBe(false);
	});
});
