/**
 * ReminderTime 불변식 단위 테스트
 */
import { ReminderTime } from "./reminder-time.vo";

describe("ReminderTime.assertValidRanges", () => {
	it("아침 리마인더가 12시 이상이면 PREFERENCE_1702", () => {
		expect(() => ReminderTime.assertValidRanges({ morningReminderHour: 13 })).toThrow(
			expect.objectContaining({ errorCode: "PREFERENCE_1702" }),
		);
	});

	it("저녁 리마인더가 12시 미만이면 PREFERENCE_1702", () => {
		expect(() => ReminderTime.assertValidRanges({ eveningReminderHour: 11 })).toThrow(
			expect.objectContaining({ errorCode: "PREFERENCE_1702" }),
		);
	});

	it("유효 범위(오전 0-11, 오후 12-23)는 통과", () => {
		expect(() =>
			ReminderTime.assertValidRanges({
				morningReminderHour: 11,
				eveningReminderHour: 12,
			}),
		).not.toThrow();
	});

	it("미지정 필드는 검증하지 않는다", () => {
		expect(() => ReminderTime.assertValidRanges({})).not.toThrow();
	});
});
