/**
 * 직교성 회귀 가드: timezone ⊥ 카피 언어
 *
 * 카피 언어(locale)와 발송 시각(timezone)은 독립이어야 한다.
 * - 빌더 메서드는 `locale`만 받고 `timezone`을 받지 않는다(구조적 분리).
 * - 같은 variant 컨텍스트라면 ko/en은 **동일 variant를 선택**(variantId 동일)하되
 *   문구(title/body)만 언어별로 다르다. 즉 선택 로직이 언어에 영향받지 않는다.
 *
 * 이 스펙이 깨지면 누군가 카피 선택을 언어/타임존에 결합시킨 것이다.
 */
import type { NotificationVariantContext } from "./notification-templates";
import { NotificationMessageBuilder } from "./notification-templates";

const context: NotificationVariantContext = {
	campaignKey: "orthogonality-test",
	recipientId: "user-1",
	occurrenceKey: "2026-07-16",
};

describe("직교성: timezone ⊥ 카피 언어", () => {
	it("아침 리마인더 — 같은 컨텍스트면 ko/en variant 선택은 동일하고 문구만 다르다", () => {
		const ko = NotificationMessageBuilder.morningReminder(3, "ko", context);
		const en = NotificationMessageBuilder.morningReminder(3, "en", context);

		expect(ko.variantId).toBe(en.variantId);
		expect(ko.title).not.toBe(en.title);
	});

	it("Win-back — 같은 컨텍스트면 ko/en variant 선택은 동일하고 문구만 다르다", () => {
		const ko = NotificationMessageBuilder.winback(7, "ko", context);
		const en = NotificationMessageBuilder.winback(7, "en", context);

		expect(ko.variantId).toBe(en.variantId);
		expect(ko.title).not.toBe(en.title);
	});

	it("저녁 리마인더 — 언어가 달라도 분기/선택은 동일하다", () => {
		const ko = NotificationMessageBuilder.eveningReminder(2, 3, 0, false, "ko", context);
		const en = NotificationMessageBuilder.eveningReminder(2, 3, 0, false, "en", context);

		expect(ko.variantId).toBe(en.variantId);
		expect(ko.title).not.toBe(en.title);
	});
});
