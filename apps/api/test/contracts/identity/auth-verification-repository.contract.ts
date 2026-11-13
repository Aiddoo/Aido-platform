import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import type { AuthVerificationRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-verification.repository.port";
import type {
  AuthVerification,
  AuthVerificationPrimitives,
} from "#api/modules/identity/auth/domain/auth-verification.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";

const LATER = AUTH_FIXTURE_NOW.add({ minutes: 1 });
let hashSequence = 0;

async function saveVerification(
  repository: AuthVerificationRepositoryPort,
  overrides: Partial<AuthVerificationPrimitives> = {},
): Promise<AuthVerification> {
  hashSequence += 1;
  const verification = createAuthVerificationFixture({
    id: (await repository.nextId()).value,
    type: "PASSWORD_RESET",
    // Verification_token_key가 유일 제약이라 행마다 다른 hash를 쓴다
    tokenHash: `digest-${hashSequence}`,
    ...overrides,
  });
  await repository.save(verification);
  return verification;
}

function consumeInput(verification: AuthVerification, at: Temporal.Instant) {
  return {
    id: verification.id,
    userId: verification.userId,
    type: verification.type,
    tokenHash: verification.tokenHash,
    maxAttempts: VERIFICATION_CODE.MAX_ATTEMPTS,
    at,
  };
}

export function describeAuthVerificationRepositoryContract(
  createRepository: () => Promise<AuthVerificationRepositoryPort>,
): void {
  describe("인증 코드 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 코드는 같은 값으로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveVerification(repository, { attempts: 2 });

      // When
      const found = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );

      // Then
      expect(found?.toPrimitives()).toEqual(saved.toPrimitives());
    });

    it("유효한 코드는 그 사용자·종류의 쓰지 않고 만료 전인 것 중 가장 최근 것이다", async () => {
      // Given
      const repository = await createRepository();
      await saveVerification(repository, { createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: 2 }) });
      const latest = await saveVerification(repository);
      await saveVerification(repository, { createdAt: LATER, usedAt: LATER });
      await saveVerification(repository, { createdAt: LATER, expiresAt: LATER });
      await saveVerification(repository, { createdAt: LATER, type: "EMAIL_VERIFY" });
      await saveVerification(repository, { createdAt: LATER, userId: AUTH_FIXTURE_OTHER_USER_ID });

      // When
      const found = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );

      // Then
      expect(found?.id.value).toBe(latest.id.value);
    });

    it("최근 발급 시각은 since와 같거나 뒤에 만든 같은 종류 코드 중 가장 늦은 것이다", async () => {
      // Given
      const repository = await createRepository();
      await saveVerification(repository, { createdAt: AUTH_FIXTURE_NOW.subtract({ seconds: 1 }) });
      await saveVerification(repository, { createdAt: AUTH_FIXTURE_NOW });
      await saveVerification(repository, { createdAt: LATER });
      await saveVerification(repository, {
        createdAt: LATER.add({ seconds: 1 }),
        type: "EMAIL_VERIFY",
      });

      // When
      const issuedAt = await repository.findLatestIssuedAtByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );
      const noneSince = await repository.findLatestIssuedAtByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER.add({ seconds: 1 }),
      );

      // Then
      expect(issuedAt).toEqual(LATER);
      expect(noneSince).toBeNull();
    });

    it("무효화는 남은 같은 종류 코드의 만료를 지금으로 당기고 그 수를 준다", async () => {
      // Given
      const repository = await createRepository();
      const active = await saveVerification(repository);
      await saveVerification(repository, { usedAt: AUTH_FIXTURE_NOW });
      await saveVerification(repository, { expiresAt: AUTH_FIXTURE_NOW });
      const otherType = await saveVerification(repository, { type: "EMAIL_VERIFY" });

      // When
      const count = await repository.invalidateAllByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );
      const remaining = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );

      // Then
      expect(count).toBe(1);
      expect(remaining?.toPrimitives()).toEqual({ ...active.toPrimitives(), expiresAt: LATER });
      expect(
        (
          await repository.findValidByUserIdAndType(
            UserId.reconstitute(AUTH_FIXTURE_USER_ID),
            "EMAIL_VERIFY",
            LATER,
          )
        )?.id.value,
      ).toBe(otherType.id.value);
    });

    it("소비는 조건이 모두 맞을 때 한 번만 성공하고 사용 시각을 남긴다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveVerification(repository);

      // When
      const first = await repository.consume(consumeInput(saved, LATER));
      const second = await repository.consume(consumeInput(saved, LATER));
      const valid = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );

      // Then
      expect({ first, second, valid }).toEqual({ first: true, second: false, valid: null });
    });

    it("다른 사용자·종류·hash, 만료, 시도 한도 중 하나라도 어긋나면 소비하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveVerification(repository, { attempts: 1 });
      const input = consumeInput(saved, LATER);

      // When
      const results = [
        await repository.consume({
          ...input,
          userId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
        }),
        await repository.consume({ ...input, type: "EMAIL_VERIFY" }),
        await repository.consume({ ...input, tokenHash: "other-digest" }),
        await repository.consume({ ...input, at: saved.expiresAt }),
        await repository.consume({ ...input, maxAttempts: 1 }),
      ];

      // Then
      expect(results).toEqual([false, false, false, false, false]);
      expect(await repository.consume(input)).toBe(true);
    });

    it("실패 횟수를 하나씩 늘리고 다시 저장한 시도·사용 칸을 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveVerification(repository);

      // When
      await repository.incrementAttempts(saved.id);
      await repository.incrementAttempts(saved.id);
      const afterIncrements = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );
      await repository.save(
        createAuthVerificationFixture({ ...saved.toPrimitives(), attempts: 4, usedAt: LATER }),
      );
      const afterSave = await repository.findLatestIssuedAtByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );

      // Then
      expect(afterIncrements?.toPrimitives().attempts).toBe(2);
      expect(afterSave).toEqual(saved.toPrimitives().createdAt);
      expect(
        await repository.findValidByUserIdAndType(
          UserId.reconstitute(AUTH_FIXTURE_USER_ID),
          "PASSWORD_RESET",
          AUTH_FIXTURE_NOW,
        ),
      ).toBeNull();
    });
  });
}
