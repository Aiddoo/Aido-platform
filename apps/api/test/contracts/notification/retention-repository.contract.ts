import { NotificationId } from "#api/modules/notification/inbox/domain/notification-id.vo";
import type { RetentionRepositoryPort } from "#api/modules/notification/retention/application/ports/retention.repository.port";
import type { RetentionStageCandidate } from "#api/modules/notification/retention/application/read-models/retention-stage-candidate.read-model";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

interface RetentionD7Result {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Temporal.Instant;
}

export interface RetentionRepositoryContractSubject {
  readonly repository: RetentionRepositoryPort;
  givenUser(profile: {
    readonly timezone: string;
    readonly locale: SupportedLocale;
  }): Promise<string>;
  d7ResultOf(assignmentId: string): Promise<RetentionD7Result | null>;
}

// 서울 09:00에 시작한 사용자. D0는 2시간 뒤, D1은 다음 날 10:30부터 결정할 때가 된다
const STARTED_AT = Temporal.Instant.from("2026-07-15T00:00:00.000Z");
const D0_ONLY_DUE_AT = Temporal.Instant.from("2026-07-15T03:00:00.000Z");
const ALL_DUE_AT = Temporal.Instant.from("2026-08-15T00:00:00.000Z");
const PROCESSED_AT = Temporal.Instant.from("2026-07-15T03:00:00.000Z");

function byCreation(left: RetentionStageCandidate, right: RetentionStageCandidate): number {
  return (
    Temporal.Instant.compare(left.stageCreatedAt, right.stageCreatedAt) ||
    left.stageId.localeCompare(right.stageId)
  );
}

async function dueStagesOf(
  repository: RetentionRepositoryPort,
  dueAt: Temporal.Instant = ALL_DUE_AT,
): Promise<RetentionStageCandidate[]> {
  return repository.findDueStages({ dueAt, limit: 200 });
}

function stageNamesOf(candidates: readonly RetentionStageCandidate[]): string[] {
  return candidates.map(({ stage }) => stage).toSorted();
}

// 등록 시각은 DB 시각(ms)이라 같은 ms에 만든 두 등록은 단계 ID 순서로 섞인다
function nextMillisecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

export function describeRetentionRepositoryContract(
  createSubject: () => Promise<RetentionRepositoryContractSubject>,
): void {
  describe("리텐션 저장소 계약", () => {
    it("시작 시각과 함께 등록하면 한 배정에 네 단계를 만들고, 다시 등록해도 처음 배정을 바꾸지 않는다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "en" });

      // When
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "CONTROL",
        startedAt: STARTED_AT,
      });

      // Then
      const stages = await dueStagesOf(repository);
      expect(stageNamesOf(stages)).toEqual(["D0", "D1", "D3", "D7"]);
      expect(new Set(stages.map(({ assignmentId }) => assignmentId)).size).toBe(1);
      for (const stage of stages) {
        expect(stage).toMatchObject({
          userId,
          variant: "TREATMENT",
          startedAt: STARTED_AT,
          timezone: "Asia/Seoul",
          locale: "en",
        });
      }
    });

    it("시작 시각 없이 등록하면 단계가 없고, 활성화는 한 번만 성공하며 그때 단계를 만든다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      const unknownUserId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "CONTROL",
        startedAt: null,
      });
      const beforeActivation = await dueStagesOf(repository);

      // When
      const first = await repository.activate(UserId.reconstitute(userId), STARTED_AT);
      const second = await repository.activate(UserId.reconstitute(userId), ALL_DUE_AT);
      const notEnrolled = await repository.activate(UserId.reconstitute(unknownUserId), STARTED_AT);

      // Then
      expect(beforeActivation).toEqual([]);
      expect([first, second, notEnrolled]).toEqual([true, false, false]);
      const stages = await dueStagesOf(repository);
      expect(stageNamesOf(stages)).toEqual(["D0", "D1", "D3", "D7"]);
      expect(stages.every((stage) => stage.startedAt.equals(STARTED_AT))).toBe(true);
    });

    it("결정할 때가 된 단계만 고른다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });

      // When
      const atStart = await dueStagesOf(repository, STARTED_AT);
      const afterD0Wait = await dueStagesOf(repository, D0_ONLY_DUE_AT);
      const later = await dueStagesOf(repository, ALL_DUE_AT);

      // Then
      expect(stageNamesOf(atStart)).toEqual([]);
      expect(stageNamesOf(afterD0Wait)).toEqual(["D0"]);
      expect(stageNamesOf(later)).toEqual(["D0", "D1", "D3", "D7"]);
    });

    it("단계를 생성 시각·ID 순서로 주고, 먼저 등록한 사용자가 앞서며, 묶음 위치 다음부터 같은 순서로 이어 읽는다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const first = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      const second = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await repository.enroll({
        userId: UserId.reconstitute(first),
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      await nextMillisecond();
      await repository.enroll({
        userId: UserId.reconstitute(second),
        variant: "CONTROL",
        startedAt: STARTED_AT,
      });

      // When
      const all = await dueStagesOf(repository);
      const paged: string[] = [];
      let after: { createdAt: Temporal.Instant; stageId: string } | undefined;
      for (;;) {
        const page = await repository.findDueStages({
          dueAt: ALL_DUE_AT,
          limit: 3,
          ...(after != null && { after }),
        });
        paged.push(...page.map(({ stageId }) => stageId));
        const last = page.at(-1);
        if (page.length < 3 || last == null) {
          break;
        }
        after = { createdAt: last.stageCreatedAt, stageId: last.stageId };
      }

      // Then
      expect(all.map(({ stageId }) => stageId)).toEqual(
        all.toSorted(byCreation).map(({ stageId }) => stageId),
      );
      expect(all.map(({ userId }) => userId)).toEqual([
        first,
        first,
        first,
        first,
        second,
        second,
        second,
        second,
      ]);
      expect(paged).toEqual(all.map(({ stageId }) => stageId));
    });

    it("단계 상태는 SCHEDULED에서 한 번만 바뀌고 바뀐 단계는 다시 고르지 않는다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [d0, d1] = (await dueStagesOf(repository)).toSorted((left, right) =>
        left.stage.localeCompare(right.stage),
      );
      if (d0 == null || d1 == null) {
        throw new Error("stage fixture 누락");
      }

      // When
      const skipped = await repository.markStageSkipped(d0.stageId, "TEST_SKIP", PROCESSED_AT);
      const skippedAgain = await repository.markStageSkipped(d0.stageId, "TEST_SKIP", PROCESSED_AT);
      const outboxSkipped = await repository.markStageOutboxed(d0.stageId, PROCESSED_AT);
      const outboxed = await repository.markStageOutboxed(d1.stageId, PROCESSED_AT);
      const outboxedAgain = await repository.markStageOutboxed(d1.stageId, PROCESSED_AT);

      // Then
      expect([skipped, skippedAgain, outboxSkipped, outboxed, outboxedAgain]).toEqual([
        true,
        false,
        false,
        true,
        false,
      ]);
      expect(stageNamesOf(await dueStagesOf(repository))).toEqual(["D3", "D7"]);
    });

    it("없는 단계에 알림을 이으면 실패한다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const linking = repository.linkStageNotification(
        "missing-stage",
        NotificationId.reconstitute(1),
        PROCESSED_AT,
      );

      // Then
      await expect(linking).rejects.toThrow();
    });

    it("D7 결과는 배정마다 하나로 남고 다시 기록하면 덮어쓴다", async () => {
      // Given
      const { repository, givenUser, d7ResultOf } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await repository.enroll({
        userId: UserId.reconstitute(userId),
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [stage] = await dueStagesOf(repository);
      if (stage == null) {
        throw new Error("stage fixture 누락");
      }
      const assignmentId = stage.assignmentId;

      // When
      await repository.recordD7Result({
        assignmentId,
        returnedWithinD7: false,
        todoActionWithinD7: false,
        measuredAt: Temporal.Instant.from("2026-07-22T01:30:00.000Z"),
      });
      await repository.recordD7Result({
        assignmentId,
        returnedWithinD7: true,
        todoActionWithinD7: true,
        measuredAt: Temporal.Instant.from("2026-07-22T01:35:00.000Z"),
      });

      // Then
      expect(await d7ResultOf(assignmentId)).toEqual({
        returnedWithinD7: true,
        todoActionWithinD7: true,
        measuredAt: Temporal.Instant.from("2026-07-22T01:35:00.000Z"),
      });
    });
  });
}
