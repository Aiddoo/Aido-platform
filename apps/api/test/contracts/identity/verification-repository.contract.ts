import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import type { VerificationRepositoryPort } from "#api/modules/identity/verifications/application/ports/verification.repository.port";
import type {
  Verification,
  VerificationPrimitives,
} from "#api/modules/identity/verifications/domain/verification.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";

const LATER = AUTH_FIXTURE_NOW.add({ minutes: 1 });
let hashSequence = 0;

async function saveVerification(
  repository: VerificationRepositoryPort,
  overrides: Partial<VerificationPrimitives> = {},
): Promise<Verification> {
  hashSequence += 1;
  const verification = createVerificationFixture({
    id: (await repository.nextId()).value,
    type: "PASSWORD_RESET",
    // Verification_token_key가 유일 제약이라 행마다 다른 hash를 쓴다
    tokenHash: `digest-${hashSequence}`,
    ...overrides,
  });
  await repository.save(verification);
  return verification;
}

async function loadVerification(
  repository: VerificationRepositoryPort,
  at: Temporal.Instant,
): Promise<Verification> {
  const found = await repository.findValidByUserIdAndType(
    UserId.reconstitute(AUTH_FIXTURE_USER_ID),
    "PASSWORD_RESET",
    at,
  );
  if (found == null) {
    throw new Error("저장한 인증 코드를 찾지 못했다");
  }
  return found;
}

export function describeVerificationRepositoryContract(
  createRepository: () => Promise<VerificationRepositoryPort>,
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

    it("소비한 코드 저장은 한 번만 성공하고 사용 시각을 남긴다", async () => {
      // Given
      const repository = await createRepository();
      await saveVerification(repository);
      const first = await loadVerification(repository, LATER);
      const stale = await loadVerification(repository, LATER);
      first.consume(LATER);
      stale.consume(LATER);

      // When
      const firstSaved = await repository.save(first);
      const staleSaved = await repository.save(stale);
      const valid = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );

      // Then
      expect({ firstSaved, staleSaved, valid }).toEqual({
        firstSaved: true,
        staleSaved: false,
        valid: null,
      });
    });

    it("소비하지 않은 코드, 그 사이 소진된 코드는 저장하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await saveVerification(repository, { attempts: VERIFICATION_CODE.MAX_ATTEMPTS - 1 });
      const untouched = await loadVerification(repository, LATER);
      const consumer = await loadVerification(repository, LATER);
      const wrongGuess = await loadVerification(repository, LATER);
      consumer.consume(LATER);
      wrongGuess.recordFailedAttempt(LATER);
      await repository.saveFailedAttempt(wrongGuess);

      // When
      const savedUntouched = await repository.save(untouched);
      const savedAfterExhausted = await repository.save(consumer);

      // Then
      expect({ savedUntouched, savedAfterExhausted }).toEqual({
        savedUntouched: false,
        savedAfterExhausted: false,
      });
    });

    it("틀린 시도는 저장할 때마다 하나씩 늘고 소비 저장은 시도 칸을 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveVerification(repository);

      // When
      await repository.saveFailedAttempt(saved);
      await repository.saveFailedAttempt(saved);
      const afterFailures = await loadVerification(repository, AUTH_FIXTURE_NOW);
      afterFailures.consume(LATER);
      const consumed = await repository.save(afterFailures);
      const afterConsume = await repository.findLatestIssuedAtByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );

      // Then
      expect(afterFailures.toPrimitives().attempts).toBe(2);
      expect(consumed).toBe(true);
      expect(afterConsume).toEqual(saved.toPrimitives().createdAt);
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
