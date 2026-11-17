import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import type { VerificationRepositoryPort } from "#api/modules/identity/verifications/application/ports/verification.repository.port";
import { Verification } from "#api/modules/identity/verifications/domain/verification.aggregate";
import type { VerificationType } from "#api/modules/identity/verifications/domain/verifications.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";

const LATER = AUTH_FIXTURE_NOW.add({ minutes: 1 });
let hashSequence = 0;

interface VerificationSeed {
  readonly createdAt?: Temporal.Instant;
  readonly type?: VerificationType;
  readonly userId?: string;
  readonly attempts?: number;
  readonly usedAt?: Temporal.Instant;
}

// 저장소는 새 코드만 넣으므로 발급(create)과 전이로 행 상태를 만든다
async function saveVerification(
  repository: VerificationRepositoryPort,
  seed: VerificationSeed = {},
): Promise<Verification> {
  hashSequence += 1;
  const createdAt = seed.createdAt ?? AUTH_FIXTURE_NOW;
  const verification = Verification.create({
    id: await repository.nextId(),
    userId: seed.userId ?? AUTH_FIXTURE_USER_ID,
    type: seed.type ?? "PASSWORD_RESET",
    // Verification_token_key가 유일 제약이라 행마다 다른 hash를 쓴다
    tokenHash: `digest-${hashSequence}`,
    now: createdAt,
  });
  for (let attempt = 0; attempt < (seed.attempts ?? 0); attempt += 1) {
    verification.recordFailedAttempt(createdAt);
  }
  if (seed.usedAt != null) {
    verification.consume(seed.usedAt);
  }
  if (!(await repository.save(verification))) {
    throw new Error("새 인증 코드를 넣지 못했다");
  }
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

    it("새 코드는 넣어 true이고 같은 값으로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const issued = Verification.create({
        id: await repository.nextId(),
        userId: AUTH_FIXTURE_USER_ID,
        type: "PASSWORD_RESET",
        tokenHash: "digest-issued",
        now: AUTH_FIXTURE_NOW,
      });
      issued.recordFailedAttempt(AUTH_FIXTURE_NOW);

      // When
      const inserted = await repository.save(issued);
      const found = await repository.findValidByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        AUTH_FIXTURE_NOW,
      );

      // Then
      expect(inserted).toBe(true);
      expect(found?.toPrimitives()).toEqual(issued.toPrimitives());
    });

    it("유효한 코드는 그 사용자·종류의 쓰지 않고 만료 전인 것 중 가장 최근 것이다", async () => {
      // Given
      const repository = await createRepository();
      await saveVerification(repository, { createdAt: LATER });
      await repository.invalidateAllByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );
      await saveVerification(repository, { createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: 2 }) });
      const latest = await saveVerification(repository);
      await saveVerification(repository, { createdAt: LATER, usedAt: LATER });
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

    it("최근 발급 시각은 since 뒤에 만든 같은 종류 코드 중 가장 늦은 것이다(since와 같은 순간은 넣지 않는다)", async () => {
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
      const issuedExactlyAtSince = await repository.findLatestIssuedAtByUserIdAndType(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "PASSWORD_RESET",
        LATER,
      );

      // Then
      expect(issuedAt).toEqual(LATER);
      expect(issuedExactlyAtSince).toBeNull();
    });

    it("무효화는 남은 같은 종류 코드의 만료를 지금으로 당기고 그 수를 준다", async () => {
      // Given
      const repository = await createRepository();
      const active = await saveVerification(repository);
      await saveVerification(repository, { usedAt: AUTH_FIXTURE_NOW });
      await saveVerification(repository, {
        createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: VERIFICATION_CODE.EXPIRY_MINUTES }),
      });
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
        AUTH_FIXTURE_NOW.subtract({ seconds: 1 }),
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

    it("만료가 기준 시각 전인 코드만 쓴 코드까지 limit개씩 지운다", async () => {
      // Given
      const repository = await createRepository();
      // 코드는 발급 10분 뒤 만료라 발급 시각으로 만료 시각을 정한다
      await saveVerification(repository, {
        createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: 10, milliseconds: 1 }),
      });
      await saveVerification(repository, {
        createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: 70 }),
        usedAt: AUTH_FIXTURE_NOW.subtract({ minutes: 65 }),
      });
      await saveVerification(repository, {
        createdAt: AUTH_FIXTURE_NOW.subtract({ minutes: 10 }),
      });

      // When
      const deletedCounts = [
        await repository.deleteExpiredBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteExpiredBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteExpiredBefore(AUTH_FIXTURE_NOW, 1),
      ];
      const remaining = await repository.deleteExpiredBefore(
        AUTH_FIXTURE_NOW.add({ milliseconds: 1 }),
        10,
      );

      // Then
      expect(deletedCounts).toEqual([1, 1, 0]);
      expect(remaining).toBe(1);
    });
  });
}
