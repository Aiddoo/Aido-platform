import { retentionPushSkipReason } from "./push-eligibility";

describe("retentionPushSkipReason — 신규 리텐션 푸시 자격", () => {
	const eligible = {
		pushEnabled: true,
		marketingPushAgreedAt: new Date("2026-07-15T00:00:00Z"),
		activeTokenCount: 1,
		timezone: "Asia/Seoul",
		now: new Date("2026-07-15T03:00:00Z"),
	};

	it("동의·설정·토큰·주간 시간 조건이 모두 맞으면 발송 가능하다", () => {
		expect(retentionPushSkipReason(eligible)).toBeNull();
	});

	it.each([
		[{ ...eligible, pushEnabled: false }, "PUSH_DISABLED"],
		[
			{ ...eligible, marketingPushAgreedAt: null },
			"MARKETING_CONSENT_REQUIRED",
		],
		[{ ...eligible, activeTokenCount: 0 }, "NO_ACTIVE_TOKEN"],
		[
			{ ...eligible, now: new Date("2026-07-15T13:00:00Z") },
			"MARKETING_QUIET_HOURS",
		],
	])("부적격 사유를 명시한다", (input, reason) => {
		expect(retentionPushSkipReason(input)).toBe(reason);
	});
});
