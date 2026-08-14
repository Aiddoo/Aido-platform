import { parseAcceptLanguage } from "./locale.decorator";

describe("parseAcceptLanguage", () => {
	it.each([
		["ko", "ko"],
		["en", "en"],
		["ko-KR", "ko"],
		["en-US", "en"],
		["en-US,en;q=0.9,ko;q=0.8", "en"],
		["ko-KR,ko;q=0.9", "ko"],
		["EN-us", "en"],
	])("'%s' 헤더는 %s로 파싱된다", (header, expected) => {
		expect(parseAcceptLanguage(header)).toBe(expected);
	});

	it.each(["ja", "ja-JP", "fr,en;q=0.9", "zh-CN"])("미지원 언어 '%s'는 ko로 폴백된다", (header) => {
		expect(parseAcceptLanguage(header)).toBe("ko");
	});

	it.each([undefined, null, "", 123, ["en"]])(
		"헤더 미전송/비정상 값(%s)은 undefined — 저장된 locale을 덮어쓰지 않는다 (1.3.x 하위 호환)",
		(header) => {
			expect(parseAcceptLanguage(header)).toBeUndefined();
		},
	);
});
