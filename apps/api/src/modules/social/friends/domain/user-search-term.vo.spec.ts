import { ErrorCode } from "@aido/api/errors";

import { UserSearchTerm } from "./user-search-term.vo.js";

describe("UserSearchTerm — 검색어 정규화", () => {
  it.each([
    { name: "앞뒤 공백", raw: "  john  ", value: "john", upperTag: "JOHN" },
    {
      name: "연속 공백",
      raw: "hong   gil    dong",
      value: "hong gil dong",
      upperTag: "HONG GIL DONG",
    },
    { name: "분해형(NFD) 한글", raw: "홍".normalize("NFD"), value: "홍", upperTag: "홍" },
  ])("$name을 정리하고 태그 비교용 대문자를 만든다", ({ raw, value, upperTag }) => {
    // When
    const term = UserSearchTerm.create(raw);

    // Then
    expect(term.value).toBe(value);
    expect(term.upperTag).toBe(upperTag);
  });

  it("공백만 있는 검색어는 FOLLOW_0911로 거절한다", () => {
    // When
    const creation = () => UserSearchTerm.create("   ");

    // Then
    expect(creation).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.FOLLOW_0911, details: { query: "   " } }),
    );
  });
});
