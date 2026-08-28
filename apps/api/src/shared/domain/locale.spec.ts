import { type SupportedLocale, toSupportedLocale } from "./locale";

const CASES: ReadonlyArray<readonly [value: unknown, expected: SupportedLocale]> = [
	["ko", "ko"],
	["en", "en"],
	["ja", "ko"],
	[null, "ko"],
	[undefined, "ko"],
];

describe("toSupportedLocale", () => {
	it.each(CASES)("%s를 지원 locale %s로 정규화한다", (value, expected) => {
		expect(toSupportedLocale(value)).toBe(expected);
	});
});
