import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { CategoryName } from "./category-name.vo.js";

describe("CategoryName", () => {
  it("1~50자는 통과", () => {
    expect(CategoryName.create("업무").value).toBe("업무");
    expect(CategoryName.create("a".repeat(50)).value).toHaveLength(50);
  });

  it("빈 문자열은 DomainException", () => {
    expect(() => CategoryName.create("")).toThrow(DomainException);
  });

  it("50자 초과는 DomainException", () => {
    expect(() => CategoryName.create("a".repeat(51))).toThrow(DomainException);
  });
});
