import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { CategoryColor } from "./category-color.vo.js";

describe("CategoryColor", () => {
  it("#RRGGBB 형식은 통과", () => {
    expect(CategoryColor.create("#FFB3B3").value).toBe("#FFB3B3");
    expect(CategoryColor.create("#00ff99").value).toBe("#00ff99");
  });

  it("형식이 아니면 DomainException", () => {
    expect(() => CategoryColor.create("FFB3B3")).toThrow(DomainException);
    expect(() => CategoryColor.create("#FFF")).toThrow(DomainException);
    expect(() => CategoryColor.create("#GGGGGG")).toThrow(DomainException);
  });
});
