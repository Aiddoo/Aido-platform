import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { CategoryColor } from "./category-color.vo.js";

describe("CategoryColor", () => {
  it("#RRGGBB 형식은 통과", () => {
    // When
    const upperCase = CategoryColor.create("#FFB3B3");
    const lowerCase = CategoryColor.create("#00ff99");

    // Then
    expect(upperCase.value).toBe("#FFB3B3");
    expect(lowerCase.value).toBe("#00ff99");
  });

  it("형식이 아니면 DomainException", () => {
    // When
    const createWithoutHash = () => CategoryColor.create("FFB3B3");
    const createShortHex = () => CategoryColor.create("#FFF");
    const createNonHex = () => CategoryColor.create("#GGGGGG");

    // Then
    expect(createWithoutHash).toThrow(DomainException);
    expect(createShortHex).toThrow(DomainException);
    expect(createNonHex).toThrow(DomainException);
  });
});
