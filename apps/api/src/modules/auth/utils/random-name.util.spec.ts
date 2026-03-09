import { generateRandomName } from "./random-name.util";

describe("generateRandomName", () => {
	it("비어있지 않은 문자열을 반환한다", () => {
		const name = generateRandomName();
		expect(name).toBeTruthy();
		expect(typeof name).toBe("string");
	});

	it("20자 이내의 이름을 반환한다", () => {
		for (let i = 0; i < 100; i++) {
			const name = generateRandomName();
			expect(name.length).toBeLessThanOrEqual(20);
		}
	});

	it("여러 번 호출 시 다른 이름을 생성할 수 있다", () => {
		const names = new Set<string>();
		for (let i = 0; i < 50; i++) {
			names.add(generateRandomName());
		}
		expect(names.size).toBeGreaterThan(1);
	});

	it("공백을 포함한 이름을 반환한다", () => {
		const name = generateRandomName();
		expect(name).toContain(" ");
		expect(name.trim().length).toBeGreaterThan(0);
	});
});
