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

	describe("배송 타임존 폴백 (미상 유저 KST quiet-hours)", () => {
		// 2026-07-16T14:00:00Z = KST 23:00(야간) / UTC 14:00(주간) / New_York 10:00(주간)
		const KST_NIGHT_UTC_DAY = new Date("2026-07-16T14:00:00.000Z");

		it("미상(UTC 저장) 유저는 KST 야간에 quiet-hours로 스킵된다", () => {
			expect(
				retentionPushSkipReason({
					...eligible,
					timezone: "UTC",
					now: KST_NIGHT_UTC_DAY,
				}),
			).toBe("MARKETING_QUIET_HOURS");
		});

		it("실제 해외 타임존 유저는 로컬 시간 기준이라 KST로 오분류되지 않는다", () => {
			expect(
				retentionPushSkipReason({
					...eligible,
					timezone: "America/New_York",
					now: KST_NIGHT_UTC_DAY,
				}),
			).toBeNull();
		});
	});
});
