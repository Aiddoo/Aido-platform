import { ErrorCode } from "@aido/api/errors";

import { InviteCode } from "./invite-code.vo.js";

describe("InviteCode — 초대 코드", () => {
  it.each([
    { raw: "K7M2QX", expected: "K7M2QX" },
    { raw: " k7m2-qx ", expected: "K7M2QX" },
    { raw: "k7 m2 qx", expected: "K7M2QX" },
  ])("'$raw'을 정규화하면 $expected가 된다", ({ raw, expected }) => {
    // When
    const code = InviteCode.create(raw);

    // Then
    expect(code.value).toBe(expected);
  });

  it.each(["K7M2Q", "K7M2QXZ", "K7M2Q0", "K7M2QO", "K7M2Q1", "K7M2QI", "K7M2QL", "K7M2QA"])(
    "길이가 다르거나 헷갈리는 글자·모음이 있는 '%s'는 SYS_0002로 거부한다",
    (raw) => {
      // When
      const create = () => InviteCode.create(raw);

      // Then
      expect(create).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_0002,
          details: { field: "inviteCode" },
        }),
      );
    },
  );
});
