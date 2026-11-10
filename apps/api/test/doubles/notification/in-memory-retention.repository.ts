import { RetentionRepositoryPort } from "#api/modules/notification/retention/application/ports/retention.repository.port";
import type {
  RetentionStageCandidate,
  RetentionStageCursor,
} from "#api/modules/notification/retention/application/read-models/retention-stage-candidate.read-model";
import { isRetentionStageDue } from "#api/modules/notification/retention/domain/retention-stage.domain-service";
import type { RetentionVariant } from "#api/modules/notification/retention/domain/retention.constants";
import type { retentionExperimentStageStatus } from "#api/platform/database/schema/index";

type StageStatus = (typeof retentionExperimentStageStatus.enumValues)[number];

export interface StoredRetentionStage {
  readonly candidate: RetentionStageCandidate;
  status: StageStatus;
  skipReason: string | null;
  processedAt: Date | null;
  notificationId: number | null;
}

interface RetentionEnrollment {
  readonly userId: string;
  readonly variant: RetentionVariant;
  startedAt: Date | null;
}

interface D7Result {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Date;
}

function isAfter(candidate: RetentionStageCandidate, cursor: RetentionStageCursor): boolean {
  const createdAt = candidate.stageCreatedAt.getTime();
  const cursorAt = cursor.createdAt.getTime();
  return createdAt > cursorAt || (createdAt === cursorAt && candidate.stageId > cursor.stageId);
}

function byCreation(left: StoredRetentionStage, right: StoredRetentionStage): number {
  const diff = left.candidate.stageCreatedAt.getTime() - right.candidate.stageCreatedAt.getTime();
  return diff === 0 ? left.candidate.stageId.localeCompare(right.candidate.stageId) : diff;
}

// Drizzle처럼 SCHEDULED이고 결정할 때가 된 단계만 생성 순서로 돌려주고 상태 전이는 한 번만 성공한다
export class InMemoryRetentionRepository extends RetentionRepositoryPort {
  readonly stages: StoredRetentionStage[];
  readonly enrollments: RetentionEnrollment[] = [];
  readonly d7Results = new Map<string, D7Result>();
  readonly dueQueries: Date[] = [];
  // 이 단계를 표시하려 하면 실패한다(발행 도중 오류를 흉내 낸다)
  failingStageIds = new Set<string>();

  constructor(candidates: readonly RetentionStageCandidate[] = []) {
    super();
    this.stages = candidates.map((candidate) => ({
      candidate,
      status: "SCHEDULED",
      skipReason: null,
      processedAt: null,
      notificationId: null,
    }));
  }

  async enroll(input: {
    readonly userId: string;
    readonly variant: RetentionVariant;
    readonly startedAt: Date | null;
  }): Promise<void> {
    if (this.enrollments.some((enrollment) => enrollment.userId === input.userId)) {
      return;
    }
    this.enrollments.push({ ...input });
  }

  async activate(userId: string, startedAt: Date): Promise<boolean> {
    const enrollment = this.enrollments.find((item) => item.userId === userId);
    if (enrollment == null || enrollment.startedAt != null) {
      return false;
    }
    enrollment.startedAt = startedAt;
    return true;
  }

  async findDueStages(params: {
    readonly dueAt: Date;
    readonly after?: RetentionStageCursor;
    readonly limit: number;
  }): Promise<RetentionStageCandidate[]> {
    this.dueQueries.push(params.dueAt);
    const { after } = params;
    return this.stages
      .filter(
        ({ candidate, status }) =>
          status === "SCHEDULED" &&
          (after == null || isAfter(candidate, after)) &&
          isRetentionStageDue(candidate.stage, {
            startedAt: candidate.startedAt,
            now: params.dueAt,
            timezone: candidate.timezone,
          }),
      )
      .toSorted(byCreation)
      .slice(0, params.limit)
      .map(({ candidate }) => candidate);
  }

  async markStageSkipped(stageId: string, reason: string, processedAt: Date): Promise<boolean> {
    return this.#transition(stageId, { status: "SKIPPED", skipReason: reason, processedAt });
  }

  async markStageOutboxed(stageId: string, processedAt: Date): Promise<boolean> {
    return this.#transition(stageId, { status: "OUTBOXED", skipReason: null, processedAt });
  }

  async linkStageNotification(stageId: string, notificationId: number): Promise<void> {
    const stage = this.#require(stageId);
    stage.notificationId = notificationId;
  }

  async recordD7Result(input: {
    readonly assignmentId: string;
    readonly returnedWithinD7: boolean;
    readonly todoActionWithinD7: boolean;
    readonly measuredAt: Date;
  }): Promise<void> {
    const { assignmentId, ...result } = input;
    this.d7Results.set(assignmentId, result);
  }

  stage(stageId: string): StoredRetentionStage {
    return this.#require(stageId);
  }

  #transition(
    stageId: string,
    next: Pick<StoredRetentionStage, "status" | "skipReason" | "processedAt">,
  ): boolean {
    if (this.failingStageIds.has(stageId)) {
      throw new Error(`stage ${stageId} failed`);
    }
    const stage = this.#require(stageId);
    if (stage.status !== "SCHEDULED") {
      return false;
    }
    Object.assign(stage, next);
    return true;
  }

  #require(stageId: string): StoredRetentionStage {
    const stage = this.stages.find((item) => item.candidate.stageId === stageId);
    if (stage == null) {
      throw new Error(`unknown retention stage ${stageId}`);
    }
    return stage;
  }
}
