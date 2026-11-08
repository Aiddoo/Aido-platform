import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import type {
  FindTrialEndingNoticesParams,
  TrialEndingNotice,
} from "../../ports/subscriptions/subscription.repository.port.js";
import { NotifyEndingTrials, TRIAL_ENDING_NOTICE } from "./notify-ending-trials.use-case.js";

const NOW = new Date("2026-12-06T03:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;

function trial(subscriptionId: number, overrides: Partial<TrialEndingNotice> = {}) {
  return {
    subscriptionId,
    userId: `user-${subscriptionId}`,
    startedAt: new Date(NOW.getTime() - 27 * DAY_MS),
    expiresAt: new Date(NOW.getTime() + 3 * DAY_MS - subscriptionId),
    willRenew: true,
    ...overrides,
  } satisfies TrialEndingNotice;
}

/** 표시하지 않은 후보만 다시 고르는 저장소 대역. 조건부 UPDATE·keyset SQL은 실제 PG에서 확인한다. */
function createNotify(candidates: readonly TrialEndingNotice[], quietUserIds = new Set<string>()) {
  const notifiedIds = new Set<number>();
  const requests: FindTrialEndingNoticesParams[] = [];
  const sent: TrialEndingNotice[] = [];
  const useCase = new NotifyEndingTrials({
    subscriptionRepository: {
      findTrialEndingNotices: async (params) => {
        requests.push(params);
        const { after } = params;
        return candidates
          .filter((candidate) => !notifiedIds.has(candidate.subscriptionId))
          .filter(
            (candidate) =>
              after == null ||
              candidate.expiresAt.getTime() > after.expiresAt.getTime() ||
              (candidate.expiresAt.getTime() === after.expiresAt.getTime() &&
                candidate.subscriptionId > after.subscriptionId),
          )
          .slice(0, params.limit);
      },
      claimTrialEndingNotices: async (ids) => {
        const claimed = ids.filter((id) => !notifiedIds.has(id));
        for (const id of claimed) {
          notifiedIds.add(id);
        }
        return claimed;
      },
    },
    notifier: {
      findUsersInQuietHours: async (userIds) =>
        new Set(userIds.filter((userId) => quietUserIds.has(userId))),
      notifyTrialEnding: async (notices) => {
        sent.push(...notices);
      },
    },
    unitOfWork: createUnitOfWorkMock(),
    logger: { log: () => {} },
  });
  return { useCase, sent, requests, quietUserIds };
}

describe("NotifyEndingTrials — 무료 체험 종료 3일 전 안내", () => {
  it("3일 안에 끝나는 체험을 해지 여부와 함께 한 번 알리고 다시 실행해도 보내지 않는다", async () => {
    // Given
    const { useCase, sent, requests } = createNotify([trial(1), trial(2, { willRenew: false })]);

    // When
    const first = await useCase.execute({ now: NOW });
    const second = await useCase.execute({ now: NOW });

    // Then
    expect(first.notifiedCount).toBe(2);
    expect(second.notifiedCount).toBe(0);
    expect(sent.map((notice) => [notice.subscriptionId, notice.willRenew])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(requests[0]?.endsBefore).toEqual(new Date(NOW.getTime() + 3 * DAY_MS));
  });

  it("현지 야간인 사용자는 표시하지 않고 미뤄 야간이 끝난 다음 실행이 보낸다", async () => {
    // Given
    const { useCase, sent, quietUserIds } = createNotify([trial(1), trial(2)], new Set(["user-1"]));

    // When
    const night = await useCase.execute({ now: NOW });
    quietUserIds.clear();
    const morning = await useCase.execute({ now: NOW });

    // Then
    expect(night).toMatchObject({ notifiedCount: 1, deferredCount: 1 });
    expect(morning).toMatchObject({ notifiedCount: 1, deferredCount: 0 });
    expect(sent.map((notice) => notice.userId)).toEqual(["user-2", "user-1"]);
  });

  it("시작할 때 이미 3일 이하로 남은 체험은 보내지 않는다", async () => {
    // Given
    const { useCase, sent } = createNotify([trial(1, { startedAt: NOW })]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({ notifiedCount: 0, skippedCount: 1 });
    expect(sent).toEqual([]);
  });

  it("두 실행이 같은 후보를 읽어도 표시를 먼저 얻은 실행만 보낸다", async () => {
    // Given
    const { useCase, sent } = createNotify([trial(1)]);

    // When
    const results = await Promise.all([
      useCase.execute({ now: NOW }),
      useCase.execute({ now: NOW }),
    ]);

    // Then
    expect(results.map((result) => result.notifiedCount).sort()).toEqual([0, 1]);
    expect(sent).toHaveLength(1);
  });

  it("후보가 한 묶음을 넘으면 keyset으로 다음 묶음을 이어 읽는다", async () => {
    // Given
    const candidates = Array.from({ length: TRIAL_ENDING_NOTICE.BATCH_SIZE + 3 }, (_, index) =>
      trial(index + 1, { expiresAt: new Date(NOW.getTime() + DAY_MS + index) }),
    );
    const { useCase, sent, requests } = createNotify(candidates);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result).toMatchObject({
      notifiedCount: TRIAL_ENDING_NOTICE.BATCH_SIZE + 3,
      hasRemaining: false,
    });
    expect(new Set(sent.map((notice) => notice.subscriptionId)).size).toBe(sent.length);
    expect(requests[1]?.after?.subscriptionId).toBe(TRIAL_ENDING_NOTICE.BATCH_SIZE);
  });
});
