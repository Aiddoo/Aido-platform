import { parseTimezoneHeader } from "./timezone.decorator";

describe("parseTimezoneHeader", () => {
	it.each([
		["Asia/Seoul", "Asia/Seoul"],
		["America/New_York", "America/New_York"],
		["UTC", "UTC"],
	])("유효한 IANA 타임존 %s를 보존한다", (header, expected) => {
		expect(parseTimezoneHeader(header)).toBe(expected);
	});

	it("일반 API에서 헤더가 없거나 잘못되면 UTC로 폴백한다", () => {
		expect(parseTimezoneHeader(undefined)).toBe("UTC");
		expect(parseTimezoneHeader("Mars/Olympus")).toBe("UTC");
	});

	it("토큰 등록 모드에서는 헤더가 없거나 잘못되면 undefined로 보존한다", () => {
		expect(
			parseTimezoneHeader(undefined, { preserveIfMissing: true }),
		).toBeUndefined();
		expect(
			parseTimezoneHeader("Mars/Olympus", { preserveIfMissing: true }),
		).toBeUndefined();
		expect(
			parseTimezoneHeader(["Asia/Seoul"], { preserveIfMissing: true }),
		).toBeUndefined();
	});
});
