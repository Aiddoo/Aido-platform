import { getKoreanSeasonalContext } from "../korean-seasonal-context";

describe("getKoreanSeasonalContext", () => {
	it("새해 연휴 기간에 해당하는 컨텍스트를 반환해야 한다", () => {
		// Given
		const date = new Date(2026, 0, 1); // 1월 1일

		// When
		const result = getKoreanSeasonalContext(date);

		// Then
		expect(result).toContain("새해 연휴 기간");
		expect(result).toContain("## 시즌 참고");
	});

	it("벚꽃 시즌에 해당하는 컨텍스트를 반환해야 한다", () => {
		// Given
		const date = new Date(2026, 3, 5); // 4월 5일

		// When
		const result = getKoreanSeasonalContext(date);

		// Then
		expect(result).toContain("벚꽃 시즌");
	});

	it("시즌에 해당하지 않는 날짜는 빈 문자열을 반환해야 한다", () => {
		// Given
		const date = new Date(2026, 9, 15); // 10월 15일

		// When
		const result = getKoreanSeasonalContext(date);

		// Then
		expect(result).toBe("");
	});

	it("여름 휴가 시즌에 7월과 8월 모두 매칭되어야 한다", () => {
		// Given
		const july = new Date(2026, 6, 15); // 7월 15일
		const august = new Date(2026, 7, 10); // 8월 10일

		// When
		const julyResult = getKoreanSeasonalContext(july);
		const augustResult = getKoreanSeasonalContext(august);

		// Then
		expect(julyResult).toContain("여름 휴가 시즌");
		expect(augustResult).toContain("여름 휴가 시즌");
	});

	it("시즌 경계 밖의 날짜는 매칭되지 않아야 한다", () => {
		// Given
		const date = new Date(2026, 3, 20); // 4월 20일 (벚꽃 시즌은 4/1-4/15)

		// When
		const result = getKoreanSeasonalContext(date);

		// Then
		expect(result).not.toContain("벚꽃 시즌");
	});

	it("연말 마무리 시즌 경계에서 정확히 매칭되어야 한다", () => {
		// Given
		const dec20 = new Date(2026, 11, 20); // 12월 20일 (경계 시작)
		const dec19 = new Date(2026, 11, 19); // 12월 19일 (경계 밖)

		// When
		const dec20Result = getKoreanSeasonalContext(dec20);
		const dec19Result = getKoreanSeasonalContext(dec19);

		// Then
		expect(dec20Result).toContain("연말 마무리 시즌");
		expect(dec19Result).not.toContain("연말 마무리 시즌");
	});
});
