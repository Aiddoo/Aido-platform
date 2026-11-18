import { ErrorCode } from "@aido/api/errors";

import { UserTag } from "./user-tag.vo.js";

describe("UserTag", () => {
  it.each(["JOHN2026", "ABCDEFGH", "12345678"])("8자 영문 대문자·숫자 %s를 받는다", (raw) => {
    // When
    const userTag = UserTag.create(raw);

    // Then
    expect(userTag.value).toBe(raw);
  });

  it.each([
    { name: "소문자", raw: "john2026" },
    { name: "8자 미만", raw: "SHORT" },
    { name: "8자 초과", raw: "TOOLONG123" },
    { name: "특수문자", raw: "JOHN-202" },
  ])("$name 태그는 SYS_0002로 거절한다", ({ raw }) => {
    // When
    const creation = () => UserTag.create(raw);

    // Then
    expect(creation).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { userTag: raw } }),
    );
  });
});
