import { match } from "ts-pattern";

import { RetentionAssignmentRepositoryPort } from "#api/modules/notification/retention-assignments/application/ports/retention-assignment.repository.port";
import type {
  RetentionStageCandidateReadModel,
  RetentionStageCursorReadModel,
} from "#api/modules/notification/retention-assignments/application/read-models/retention-stage-candidate.read-model";
import type { RetentionAssignmentId } from "#api/modules/notification/retention-assignments/domain/retention-assignment-id.vo";
import {
  RetentionAssignment,
  type RetentionAssignmentPrimitives,
} from "#api/modules/notification/retention-assignments/domain/retention-assignment.aggregate";
import type { RetentionStageStatus } from "#api/modules/notification/retention-assignments/domain/retention-assignments.constants";
import { isRetentionStageDue } from "#api/modules/notification/retention-assignments/domain/retention-stage.domain-service";
import type { RetentionStagePrimitives } from "#api/modules/notification/retention-assignments/domain/retention-stage.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createRetentionStageCandidateFixture } from "#test/fixtures/notification/retention-stage-candidate.fixture";

export interface StoredRetentionStage {
  readonly candidate: RetentionStageCandidateReadModel;
  readonly status: RetentionStageStatus;
  readonly skipReason: string | null;
  readonly processedAt: Temporal.Instant | null;
  readonly notificationId: number | null;
}

interface D7Result {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Temporal.Instant;
}

export type RetentionUserProfile = Partial<
  Omit<
    RetentionStageCandidateReadModel,
    "assignmentId" | "stageId" | "stageCreatedAt" | "userId" | "variant" | "stage" | "startedAt"
  >
>;

function isAfter(
  candidate: RetentionStageCandidateReadModel,
  cursor: RetentionStageCursorReadModel,
): boolean {
  const order = Temporal.Instant.compare(candidate.stageCreatedAt, cursor.createdAt);
  return order > 0 || (order === 0 && candidate.stageId > cursor.stageId);
}

function byCreation(
  left: RetentionStageCandidateReadModel,
  right: RetentionStageCandidateReadModel,
): number {
  const diff = Temporal.Instant.compare(left.stageCreatedAt, right.stageCreatedAt);
  return diff === 0 ? left.stageId.localeCompare(right.stageId) : diff;
}

// 생성자로 넣은 후보는 그 배정·단계로 저장한 것처럼 둔다
function assignmentsOf(
  candidates: readonly RetentionStageCandidateReadModel[],
): RetentionAssignmentPrimitives[] {
  const byAssignment = Map.groupBy(candidates, (candidate) => candidate.assignmentId);
  return [...byAssignment.entries()].flatMap(([id, stages]) => {
    const [first] = stages;
    if (first == null) {
      return [];
    }
    return [
      {
        id,
        userId: first.userId,
        variant: first.variant,
        startedAt: first.startedAt,
        stages: stages.map((candidate) => ({
          id: candidate.stageId,
          stage: candidate.stage,
          status: "SCHEDULED" as const,
          skipReason: null,
          processedAt: null,
          notificationId: null,
          updatedAt: candidate.startedAt,
        })),
      },
    ];
  });
}

// Drizzle처럼 save는 바뀐 것만 반영하고, 단계 닫기는 저장된 단계가 SCHEDULED일 때만, 시작은 아직 시작 전일 때만,
// 등록은 같은 사용자 배정이 없을 때만 성공한다. 단계의 사용자 정보는 givenUser로 넣은 값, 없으면 fixture 기본값이다
export class InMemoryRetentionAssignmentRepository extends RetentionAssignmentRepositoryPort {
  readonly d7Results = new Map<string, D7Result>();
  readonly dueQueries: Temporal.Instant[] = [];
  // 이 단계를 닫으려 하면 실패한다(발행 도중 오류를 흉내 낸다)
  failingStageIds = new Set<string>();
  // 읽은 뒤 저장하기 전에 다른 실행이 먼저 닫은 단계다
  stagesClosedByOtherRun = new Set<string>();
  // 후보로 고른 뒤 배정을 읽기 전에 다른 실행이 먼저 발행한 단계다(읽으면 OUTBOXED다)
  stagesOutboxedBeforeLoad = new Set<string>();
  readonly #assignments = new Map<string, RetentionAssignmentPrimitives>();
  readonly #candidates = new Map<string, RetentionStageCandidateReadModel>();
  readonly #profiles = new Map<string, RetentionUserProfile>();
  readonly #now: () => Temporal.Instant;
  #sequence = 0;

  constructor(
    candidates: readonly RetentionStageCandidateReadModel[] = [],
    now: () => Temporal.Instant = () => Temporal.Instant.fromEpochMilliseconds(Date.now()),
  ) {
    super();
    this.#now = now;
    for (const candidate of candidates) {
      this.#candidates.set(candidate.stageId, candidate);
    }
    for (const assignment of assignmentsOf(candidates)) {
      this.#assignments.set(assignment.id, assignment);
    }
  }

  get assignments(): readonly RetentionAssignmentPrimitives[] {
    return [...this.#assignments.values()];
  }

  get enrollments(): ReadonlyArray<{
    readonly userId: string;
    readonly variant: RetentionAssignmentPrimitives["variant"];
    readonly startedAt: Temporal.Instant | null;
  }> {
    return this.assignments.map(({ userId, variant, startedAt }) => ({
      userId,
      variant,
      startedAt,
    }));
  }

  givenUser(userId: string, profile: RetentionUserProfile = {}): void {
    this.#profiles.set(userId, profile);
  }

  async findByUserId(userId: UserId): Promise<RetentionAssignment | null> {
    const stored = this.assignments.find((assignment) => assignment.userId === userId.value);
    return stored == null ? null : RetentionAssignment.reconstitute(stored);
  }

  async listByIds(
    ids: readonly RetentionAssignmentId[],
  ): Promise<ReadonlyMap<string, RetentionAssignment>> {
    for (const assignment of this.assignments) {
      for (const stage of assignment.stages) {
        if (this.stagesOutboxedBeforeLoad.has(stage.id)) {
          this.#updateStage(assignment.id, { ...stage, status: "OUTBOXED" });
        }
      }
    }
    return new Map(
      ids.flatMap((id) => {
        const stored = this.#assignments.get(id.value);
        return stored == null ? [] : [[id.value, RetentionAssignment.reconstitute(stored)]];
      }),
    );
  }

  async save(assignment: RetentionAssignment): Promise<boolean> {
    const next = assignment.toPrimitives();
    const changes = assignment.pullChanges();
    if (changes.length === 0) {
      return false;
    }
    for (const change of changes) {
      const applied = match(change)
        .with({ kind: "ENROLLED" }, () => this.#enroll(next))
        .with({ kind: "ACTIVATED" }, () => this.#start(next))
        .with({ kind: "STAGE_CLOSED" }, ({ stage }) =>
          this.#closeStage(next.id, stage.toPrimitives()),
        )
        .with({ kind: "STAGE_LINKED" }, ({ stage }) =>
          this.#updateStage(next.id, stage.toPrimitives()),
        )
        .with({ kind: "D7_MEASURED" }, ({ result }) => {
          this.d7Results.set(next.id, { ...result.value });
          return true;
        })
        .exhaustive();
      if (!applied) {
        return false;
      }
    }
    return true;
  }

  async listDueStages(params: {
    readonly dueAt: Temporal.Instant;
    readonly after?: RetentionStageCursorReadModel;
    readonly limit: number;
  }): Promise<RetentionStageCandidateReadModel[]> {
    this.dueQueries.push(params.dueAt);
    const { after } = params;
    return this.assignments
      .flatMap((assignment) =>
        assignment.stages.flatMap((stage) => {
          const candidate = this.#candidates.get(stage.id);
          return stage.status === "SCHEDULED" && candidate != null ? [candidate] : [];
        }),
      )
      .filter(
        (candidate) =>
          (after == null || isAfter(candidate, after)) &&
          isRetentionStageDue(candidate.stage, {
            startedAt: candidate.startedAt,
            now: params.dueAt,
            timezone: candidate.timezone,
          }),
      )
      .toSorted(byCreation)
      .slice(0, params.limit);
  }

  removeStage(stageId: string): void {
    for (const assignment of this.assignments) {
      this.#assignments.set(assignment.id, {
        ...assignment,
        stages: assignment.stages.filter((stage) => stage.id !== stageId),
      });
    }
  }

  stage(stageId: string): StoredRetentionStage {
    const candidate = this.#candidates.get(stageId);
    const stage = this.assignments
      .flatMap((assignment) => assignment.stages)
      .find((item) => item.id === stageId);
    if (candidate == null || stage == null) {
      throw new Error(`unknown retention stage ${stageId}`);
    }
    return {
      candidate,
      status: stage.status,
      skipReason: stage.skipReason,
      processedAt: stage.processedAt,
      notificationId: stage.notificationId,
    };
  }

  #enroll(next: RetentionAssignmentPrimitives): boolean {
    if (this.assignments.some((assignment) => assignment.userId === next.userId)) {
      return false;
    }
    this.#assignments.set(next.id, next);
    this.#describeStages(next);
    return true;
  }

  #start(next: RetentionAssignmentPrimitives): boolean {
    const stored = this.#assignments.get(next.id);
    if (stored == null || stored.startedAt != null) {
      return false;
    }
    this.#assignments.set(next.id, next);
    this.#describeStages(next);
    return true;
  }

  #closeStage(assignmentId: string, stage: RetentionStagePrimitives): boolean {
    if (this.failingStageIds.has(stage.id)) {
      throw new Error(`stage ${stage.id} failed`);
    }
    const stored = this.#assignments.get(assignmentId)?.stages.find((item) => item.id === stage.id);
    if (stored?.status !== "SCHEDULED" || this.stagesClosedByOtherRun.has(stage.id)) {
      return false;
    }
    return this.#updateStage(assignmentId, stage);
  }

  #updateStage(assignmentId: string, stage: RetentionStagePrimitives): boolean {
    const stored = this.#assignments.get(assignmentId);
    if (stored == null || !stored.stages.some((item) => item.id === stage.id)) {
      throw new Error(`unknown retention stage ${stage.id}`);
    }
    this.#assignments.set(assignmentId, {
      ...stored,
      stages: stored.stages.map((item) => (item.id === stage.id ? stage : item)),
    });
    return true;
  }

  // 한 번에 만든 네 단계는 생성 시각이 같고 ID 순서가 생성 순서다
  #describeStages(assignment: RetentionAssignmentPrimitives): void {
    const { startedAt } = assignment;
    if (startedAt == null) {
      return;
    }
    const stageCreatedAt = this.#now();
    const renamed = assignment.stages.map((stage) => {
      this.#sequence += 1;
      const stageId = `retention-stage-${String(this.#sequence).padStart(6, "0")}`;
      this.#candidates.set(
        stageId,
        createRetentionStageCandidateFixture({
          ...this.#profiles.get(assignment.userId),
          assignmentId: assignment.id,
          stageId,
          stageCreatedAt,
          userId: assignment.userId,
          variant: assignment.variant,
          stage: stage.stage,
          startedAt,
        }),
      );
      return { ...stage, id: stageId };
    });
    this.#assignments.set(assignment.id, { ...assignment, stages: renamed });
  }
}
