import { RandomInviteCodeGeneratorAdapter } from "./invite-code-generator.adapter.js";

// 출시 앱·초대 링크가 읽는 코드 모양이라 6자와 헷갈리는 글자·모음을 뺀 알파벳을 고정한다
const RELEASED_INVITE_CODE = /^[23456789BCDFGHJKMNPQRSTVWXZ]{6}$/;

describe("RandomInviteCodeGeneratorAdapter", () => {
  it("만든 코드는 출시 때와 같은 6자 알파벳 모양이다", () => {
    // Given
    const generator = new RandomInviteCodeGeneratorAdapter();

    // When
    const codes = Array.from({ length: 200 }, () => generator.generate().value);

    // Then
    expect(codes.every((code) => RELEASED_INVITE_CODE.test(code))).toBe(true);
  });
});
