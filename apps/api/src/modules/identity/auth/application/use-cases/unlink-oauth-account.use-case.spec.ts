import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";

import { UnlinkOAuthAccountUseCase } from "./unlink-oauth-account.use-case.js";

// 작업이 끝난 커밋 시점의 상태를 남겨 커밋 뒤에 할 일이 트랜잭션 안에서 실행되지 않았는지 본다
class CommitProbeUnitOfWork<T> extends UnitOfWorkPort {
  readonly observed: T[] = [];
  readonly #probe: () => T;

  constructor(probe: () => T) {
    super();
    this.#probe = probe;
  }

  async run<R>(work: () => Promise<R>): Promise<R> {
    const result = await work();
    this.observed.push(this.#probe());
    return result;
  }
}

describe("UnlinkOAuthAccount — 마지막 로그인 수단 보호", () => {
  it("Credential 로그인을 남긴 채 소셜 연결을 제거하고 커밋 뒤 캐시를 무효화한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    await fixture.accountRepository.createOAuthAccount({
      userId: UserId.reconstitute(fixture.user.id),
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });
    fixture.cacheService.userIds.add(fixture.user.id);
    const metadata = { ip: "192.0.2.20", userAgent: "연결 해제 기기" };
    const unitOfWork = new CommitProbeUnitOfWork(() =>
      fixture.cacheService.userIds.has(fixture.user.id),
    );
    // When
    const result = await new UnlinkOAuthAccountUseCase({ ...fixture, unitOfWork }).execute({
      userId: fixture.user.id,
      provider: "GOOGLE",
      metadata,
    });
    // Then
    expect(result.message).toBe("계정 연결이 해제되었습니다.");
    expect(fixture.accountRepository.all.map((account) => account.provider)).toEqual([
      "CREDENTIAL",
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.OAUTH_UNLINKED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { provider: "GOOGLE" },
      },
    ]);
    expect(unitOfWork.observed).toEqual([true]);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
  });

  it.each([
    {
      description: "없는 제공자",
      provider: "APPLE",
      errorCode: ErrorCode.USER_0603,
      details: { provider: undefined },
    },
    {
      description: "마지막 로그인 수단",
      provider: "GOOGLE",
      errorCode: ErrorCode.USER_0610,
      details: undefined,
    },
  ] satisfies Array<{
    description: string;
    provider: "APPLE" | "GOOGLE";
    errorCode: string;
    details: object | undefined;
  }>)(
    "$description: 기존 오류 우선순위로 거부하고 계정·감사·캐시를 유지한다",
    async ({ provider, errorCode, details }) => {
      // Given
      const fixture = createAuthOAuthFixture("GOOGLE", { socialOnly: true });
      fixture.cacheService.userIds.add(fixture.user.id);
      // When
      const pending = new UnlinkOAuthAccountUseCase(fixture).execute({
        userId: fixture.user.id,
        provider,
      });
      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode,
        ...(details == null ? {} : { details }),
      });
      expect(fixture.accountRepository.all).toHaveLength(1);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    },
  );
});
