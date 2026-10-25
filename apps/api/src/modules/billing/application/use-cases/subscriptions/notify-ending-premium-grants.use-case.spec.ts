import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import type {
  FindPremiumGrantEndingNoticesParams,
  PremiumGrantEndingNotice,
} from "../../ports/subscriptions/premium-grant.repository.port.js";
import {
  NotifyEndingPremiumGrants,
  PREMIUM_GRANT_ENDING_NOTICE,
} from "./notify-ending-premium-grants.use-case.js";

const NOW = new Date("2028-02-26T13:00:00.000Z");

function notice(index: number, userId: string): PremiumGrantEndingNotice {
  return {
    grantId: `grant-${String(index).padStart(5, "0")}`,
    userId,
    endsAt: new Date(NOW.getTime() + 60_000 + index),
  };
}

/** 표시하지 않은 후보만 다시 고르는 저장소 대역. 잠금·keyset SQL은 실제 PG에서 확인한다. */
function createNotify(candidates: readonly PremiumGrantEndingNotice[], quietUserIds: Set<string>) {
  const notifiedGrantIds = new Set<string>();
  const requests: FindPremiumGrantEndingNoticesParams[] = [];
  const sent: PremiumGrantEndingNotice[] = [];
  const useCase = new NotifyEndingPremiumGrants({
    premiumGrantRepository: {
      lockEndingNotices: async (params) => {
        requests.push(params);
        const { after } = params;
        return candidates
          .filter((candidate) => !notifiedGrantIds.has(candidate.grantId))
          .filter(
            (candidate) =>
              after == null ||
              candidate.endsAt.getTime() > after.endsAt.getTime() ||
              (candidate.endsAt.getTime() === after.endsAt.getTime() &&
                candidate.grantId > after.grantId),
          )
          .slice(0, params.limit);
      },
      markEndingNotified: async (grantIds) => {
        for (const grantId of grantIds) notifiedGrantIds.add(grantId);
      },
    },
    notifier: {
      findUsersInQuietHours: async (userIds) =>
        new Set(userIds.filter((userId) => quietUserIds.has(userId))),
      notifyEndingSoon: async (notices) => {
        sent.push(...notices);
      },
    },
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLogger>(),
  });
  return { useCase, notifiedGrantIds, requests, sent };
}

describe("NotifyEndingPremiumGrants", () => {
  it("앞자리 묶음이 모두 야간 사용자여도 같은 실행에서 뒤의 다른 시간대 사용자에게 보낸다", async () => {
    // Given
    const night = Array.from({ length: PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE }, (_, index) =>
      notice(index, `seoul-${index}`),
    );
    const day = notice(PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE, "los-angeles");
    const quiet = new Set(night.map((candidate) => candidate.userId));
    const { useCase, sent, requests } = createNotify([...night, day], quiet);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(sent).toEqual([day]);
    expect(requests.map((request) => request.after?.grantId)).toEqual([
      undefined,
      night.at(-1)?.grantId,
    ]);
    expect(result).toEqual({
      notifiedCount: 1,
      deferredCount: PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE,
      hasRemaining: false,
    });
  });

  it("야간이라 미룬 기간은 표시하지 않아 다음 허용 시각의 실행이 보낸다", async () => {
    // Given
    const candidate = notice(0, "seoul");
    const quiet = new Set(["seoul"]);
    const { useCase, sent, notifiedGrantIds } = createNotify([candidate], quiet);

    // When
    const atNight = await useCase.execute({ now: NOW });
    quiet.clear();
    const inMorning = await useCase.execute({ now: NOW });

    // Then
    expect([atNight.notifiedCount, atNight.deferredCount]).toEqual([0, 1]);
    expect([inMorning.notifiedCount, inMorning.deferredCount]).toEqual([1, 0]);
    expect(sent).toEqual([candidate]);
    expect([...notifiedGrantIds]).toEqual([candidate.grantId]);
  });

  it("한 실행이 읽는 묶음 수에 상한을 두고 남은 후보를 알린다", async () => {
    // Given
    const total =
      PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE * PREMIUM_GRANT_ENDING_NOTICE.MAX_BATCHES_PER_RUN;
    const candidates = Array.from({ length: total + 1 }, (_, index) =>
      notice(index, `quiet-${index}`),
    );
    const quiet = new Set(candidates.map((candidate) => candidate.userId));
    const { useCase, requests } = createNotify(candidates, quiet);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(requests).toHaveLength(PREMIUM_GRANT_ENDING_NOTICE.MAX_BATCHES_PER_RUN);
    expect(result).toEqual({ notifiedCount: 0, deferredCount: total, hasRemaining: true });
  });
});
