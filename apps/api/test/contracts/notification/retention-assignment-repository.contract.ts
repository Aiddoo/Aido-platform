import type { SupportedLocale } from "@aido/api/vocabulary";

import type { RetentionAssignmentRepositoryPort } from "#api/modules/notification/retention-assignments/application/ports/retention-assignment.repository.port";
import type { RetentionStageCandidateReadModel } from "#api/modules/notification/retention-assignments/application/read-models/retention-stage-candidate.read-model";
import { RetentionD7Result } from "#api/modules/notification/retention-assignments/domain/retention-d7-result.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  activateRetentionAssignment,
  enrollRetentionAssignment,
  retentionAssignmentOf,
} from "#test/fixtures/notification/retention-assignment.fixture";

interface StoredD7Result {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Temporal.Instant;
}

export interface RetentionRepositoryContractSubject {
  readonly repository: RetentionAssignmentRepositoryPort;
  givenUser(profile: {
    readonly timezone: string;
    readonly locale: SupportedLocale;
  }): Promise<string>;
  d7ResultOf(assignmentId: string): Promise<StoredD7Result | null>;
  // 읽은 뒤 단계 행이 사라진 상황을 만든다(배정 삭제 cascade 등)
  removeStage(stageId: string): Promise<void>;
}

// 서울 09:00에 시작한 사용자. D0는 2시간 뒤, D1은 다음 날 10:30부터 결정할 때가 된다
const STARTED_AT = Temporal.Instant.from("2026-07-15T00:00:00.000Z");
const D0_ONLY_DUE_AT = Temporal.Instant.from("2026-07-15T03:00:00.000Z");
const ALL_DUE_AT = Temporal.Instant.from("2026-08-15T00:00:00.000Z");
const PROCESSED_AT = Temporal.Instant.from("2026-07-15T03:00:00.000Z");

function byCreation(
  left: RetentionStageCandidateReadModel,
  right: RetentionStageCandidateReadModel,
): number {
  return (
    Temporal.Instant.compare(left.stageCreatedAt, right.stageCreatedAt) ||
    left.stageId.localeCompare(right.stageId)
  );
}

async function dueStagesOf(
  repository: RetentionAssignmentRepositoryPort,
  dueAt: Temporal.Instant = ALL_DUE_AT,
): Promise<RetentionStageCandidateReadModel[]> {
  return repository.findDueStages({ dueAt, limit: 200 });
}

function stageNamesOf(candidates: readonly RetentionStageCandidateReadModel[]): string[] {
  return candidates.map(({ stage }) => stage).toSorted();
}

// 등록 시각은 DB 시각(ms)이라 같은 ms에 만든 두 등록은 단계 ID 순서로 섞인다
function nextMillisecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

export function describeRetentionAssignmentRepositoryContract(
  createSubject: () => Promise<RetentionRepositoryContractSubject>,
): void {
  describe("리텐션 배정 저장소 계약", () => {
    it("시작 시각과 함께 등록하면 한 배정에 네 단계를 만들고, 다시 등록해도 처음 배정을 바꾸지 않는다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "en" });

      // When
      const first = await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const again = await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "CONTROL",
        startedAt: STARTED_AT,
      });

      // Then
      expect([first, again]).toEqual([true, false]);
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
      await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "CONTROL",
        startedAt: null,
      });
      const beforeActivation = await dueStagesOf(repository);

      // When
      const first = await activateRetentionAssignment(repository, userId, STARTED_AT);
      const second = await activateRetentionAssignment(repository, userId, ALL_DUE_AT);
      const notEnrolled = await activateRetentionAssignment(repository, unknownUserId, STARTED_AT);

      // Then
      expect(beforeActivation).toEqual([]);
      expect([first, second, notEnrolled]).toEqual([true, false, false]);
      const stages = await dueStagesOf(repository);
      expect(stageNamesOf(stages)).toEqual(["D0", "D1", "D3", "D7"]);
      expect(stages.every((stage) => stage.startedAt.equals(STARTED_AT))).toBe(true);
    });

    it("시작 전으로 배정된 사용자를 시작 시각과 함께 다시 등록해도 시작하지 않는다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: null,
      });

      // When
      const enrolledAgain = await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });

      // Then
      expect(enrolledAgain).toBe(false);
      expect(await dueStagesOf(repository)).toEqual([]);
      expect((await repository.findByUserId(UserId.reconstitute(userId)))?.startedAt).toBeNull();
    });

    it("결정할 때가 된 단계만 고른다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await enrollRetentionAssignment(repository, {
        userId: userId,
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
      await enrollRetentionAssignment(repository, {
        userId: first,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      await nextMillisecond();
      await enrollRetentionAssignment(repository, {
        userId: second,
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
      await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [d0, d1] = (await dueStagesOf(repository)).toSorted((left, right) =>
        left.stage.localeCompare(right.stage),
      );
      if (d0 == null || d1 == null) {
        throw new Error("stage fixture 누락");
      }
      const winner = await retentionAssignmentOf(repository, d0.assignmentId);
      const stale = await retentionAssignmentOf(repository, d0.assignmentId);

      // When
      winner.skipStage(d0.stageId, "TEST_SKIP", PROCESSED_AT);
      const skipped = await repository.save(winner);
      stale.outboxStage(d0.stageId, PROCESSED_AT);
      const lostRace = await repository.save(stale);
      const fresh = await retentionAssignmentOf(repository, d0.assignmentId);
      fresh.outboxStage(d1.stageId, PROCESSED_AT);
      const outboxed = await repository.save(fresh);

      // Then
      expect([skipped, lostRace, outboxed]).toEqual([true, false, true]);
      expect(stageNamesOf(await dueStagesOf(repository))).toEqual(["D3", "D7"]);
    });

    it("단계에 이은 알림 id를 남긴다", async () => {
      // Given
      const { repository, givenUser } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [stage] = await dueStagesOf(repository);
      if (stage == null) {
        throw new Error("stage fixture 누락");
      }
      const assignment = await retentionAssignmentOf(repository, stage.assignmentId);

      // When
      assignment.outboxStage(stage.stageId, PROCESSED_AT);
      assignment.linkStageNotification(stage.stageId, 41, PROCESSED_AT);
      const saved = await repository.save(assignment);

      // Then
      expect(saved).toBe(true);
      const reloaded = await retentionAssignmentOf(repository, stage.assignmentId);
      expect(
        reloaded.stages.find((item) => item.id.value === stage.stageId)?.toPrimitives(),
      ).toMatchObject({ status: "OUTBOXED", notificationId: 41, processedAt: PROCESSED_AT });
    });

    it("저장소에 없는 단계에 알림을 이으면 저장이 실패한다", async () => {
      // Given
      const { repository, givenUser, removeStage } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await enrollRetentionAssignment(repository, {
        userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [stage] = await dueStagesOf(repository);
      if (stage == null) {
        throw new Error("stage fixture 누락");
      }
      const assignment = await retentionAssignmentOf(repository, stage.assignmentId);
      await removeStage(stage.stageId);

      // When
      assignment.linkStageNotification(stage.stageId, 41, PROCESSED_AT);
      const saving = repository.save(assignment);

      // Then
      await expect(saving).rejects.toThrow();
    });

    it("D7 결과는 배정마다 하나로 남고 다시 기록하면 덮어쓴다", async () => {
      // Given
      const { repository, givenUser, d7ResultOf } = await createSubject();
      const userId = await givenUser({ timezone: "Asia/Seoul", locale: "ko" });
      await enrollRetentionAssignment(repository, {
        userId: userId,
        variant: "TREATMENT",
        startedAt: STARTED_AT,
      });
      const [stage] = await dueStagesOf(repository);
      if (stage == null) {
        throw new Error("stage fixture 누락");
      }
      const assignmentId = stage.assignmentId;

      const assignment = await retentionAssignmentOf(repository, assignmentId);

      // When
      assignment.measureD7(
        RetentionD7Result.create({
          returnedWithinD7: false,
          todoActionWithinD7: false,
          measuredAt: Temporal.Instant.from("2026-07-22T01:30:00.000Z"),
        }),
      );
      await repository.save(assignment);
      assignment.measureD7(
        RetentionD7Result.create({
          returnedWithinD7: true,
          todoActionWithinD7: true,
          measuredAt: Temporal.Instant.from("2026-07-22T01:35:00.000Z"),
        }),
      );
      await repository.save(assignment);

      // Then
      expect(await d7ResultOf(assignmentId)).toEqual({
        returnedWithinD7: true,
        todoActionWithinD7: true,
        measuredAt: Temporal.Instant.from("2026-07-22T01:35:00.000Z"),
      });
    });
  });
}
