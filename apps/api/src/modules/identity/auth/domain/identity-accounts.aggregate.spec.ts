import { ErrorCode } from "@aido/api/errors";

import { AccountFixture } from "#test/fixtures/index";

import { IdentityAccounts } from "./identity-accounts.aggregate.js";

function givenAccounts() {
  return IdentityAccounts.reconstitute({
    userId: "owner",
    accounts: [
      AccountFixture.create({ id: 1, provider: "GOOGLE", userId: "owner" }),
      AccountFixture.create({ id: 2, provider: "KAKAO", userId: "owner" }),
    ],
  });
}

describe("IdentityAccounts — 로그인 수단 유지", () => {
  it("계정 하나를 해제한 뒤 남은 마지막 로그인 수단의 해제를 거부한다", () => {
    // Given
    const accounts = givenAccounts();
    // When
    accounts.unlink("GOOGLE");
    // Then
    expect(accounts.canUnlink).toBe(false);
    expect(() => accounts.unlink("KAKAO")).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.USER_0610 }),
    );
  });

  it("없는 계정을 해제하면 마지막 수단 검사보다 기존 not-found 오류를 우선한다", () => {
    // Given
    const accounts = givenAccounts();
    accounts.unlink("GOOGLE");
    // When / Then
    expect(() => accounts.unlink("APPLE")).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.USER_0603, details: { provider: undefined } }),
    );
  });

  it("credential 계정도 로그인 수단으로 포함하고 외부 배열 변경과 분리한다", () => {
    // Given
    const credential = AccountFixture.create({ id: 1, provider: "CREDENTIAL" });
    const google = AccountFixture.create({ id: 2, provider: "GOOGLE" });
    const source = [credential, google];
    const accounts = IdentityAccounts.reconstitute({ userId: "owner", accounts: source });
    source.pop();
    google.provider = "APPLE";
    // When
    accounts.unlink("GOOGLE");
    // Then
    expect(() => accounts.unlink("CREDENTIAL")).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.USER_0610 }),
    );
  });
});
