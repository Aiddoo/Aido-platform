import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { CategoryColor } from "./category-color.vo";

describe("CategoryColor", () => {
	it("#RRGGBB 형식은 통과", () => {
		expect(CategoryColor.of("#FFB3B3").value).toBe("#FFB3B3");
		expect(CategoryColor.of("#00ff99").value).toBe("#00ff99");
	});

	it("형식이 아니면 DomainException", () => {
		expect(() => CategoryColor.of("FFB3B3")).toThrow(DomainException);
		expect(() => CategoryColor.of("#FFF")).toThrow(DomainException);
		expect(() => CategoryColor.of("#GGGGGG")).toThrow(DomainException);
	});
});
