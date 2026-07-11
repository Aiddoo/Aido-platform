import { formatDate, formatPrice } from "./discord-format";

describe("discord-format 도메인 서비스", () => {
	describe("formatDate", () => {
		it("유효한 ISO 문자열을 Discord 타임스탬프(<t:unix:f>)로 변환한다", () => {
			const iso = "2026-07-11T00:00:00.000Z";
			const unix = Math.floor(Date.parse(iso) / 1000);
			expect(formatDate(iso)).toBe(`<t:${unix}:f>`);
		});

		it("유효하지 않은 날짜 문자열은 원본을 그대로 반환한다 (NaN 방지)", () => {
			// new Date('not-a-date')는 예외 대신 Invalid Date(NaN)를 반환한다 →
			// <t:NaN:f> 대신 원본 문자열이 반환되어야 한다.
			expect(formatDate("not-a-date")).toBe("not-a-date");
			expect(formatDate("")).toBe("");
		});
	});

	describe("formatPrice", () => {
		it("통화 코드가 있으면 통화 포맷으로 변환한다", () => {
			expect(formatPrice(1000, "KRW")).toContain("1,000");
		});

		it("통화 코드가 없으면 숫자만 표시한다", () => {
			expect(formatPrice(1000)).toBe("1,000");
		});
	});
});
