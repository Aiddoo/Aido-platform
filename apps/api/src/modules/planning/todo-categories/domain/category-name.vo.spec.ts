import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { CategoryName } from "./category-name.vo.js";

describe("CategoryName", () => {
  it("1~50자는 통과", () => {
    // When
    const shortName = CategoryName.create("업무");
    const longestName = CategoryName.create("a".repeat(50));

    // Then
    expect(shortName.value).toBe("업무");
    expect(longestName.value).toHaveLength(50);
  });

  it("빈 문자열은 DomainException", () => {
    // When
    const create = () => CategoryName.create("");

    // Then
    expect(create).toThrow(DomainException);
  });

  it("50자 초과는 DomainException", () => {
    // When
    const create = () => CategoryName.create("a".repeat(51));

    // Then
    expect(create).toThrow(DomainException);
  });
});
