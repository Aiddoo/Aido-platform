import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { CategoryName } from "./category-name.vo";

describe("CategoryName", () => {
	it("1~50자는 통과", () => {
		expect(CategoryName.of("업무").value).toBe("업무");
		expect(CategoryName.of("a".repeat(50)).value).toHaveLength(50);
	});

	it("빈 문자열은 DomainException", () => {
		expect(() => CategoryName.of("")).toThrow(DomainException);
	});

	it("50자 초과는 DomainException", () => {
		expect(() => CategoryName.of("a".repeat(51))).toThrow(DomainException);
	});
});
