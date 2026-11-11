import type { NotificationId } from "#api/modules/notification/inbox/domain/notification-id.vo";
import { RetentionRepositoryPort } from "#api/modules/notification/retention/application/ports/retention.repository.port";
import type {
  RetentionStageCandidate,
  RetentionStageCursor,
} from "#api/modules/notification/retention/application/read-models/retention-stage-candidate.read-model";
import { isRetentionStageDue } from "#api/modules/notification/retention/domain/retention-stage.domain-service";
import {
  RETENTION_STAGE_NAMES,
  type RetentionVariant,
} from "#api/modules/notification/retention/domain/retention.constants";
import type { retentionExperimentStageStatus } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createRetentionStageCandidateFixture } from "#test/fixtures/notification/retention-stage-candidate.fixture";

type StageStatus = (typeof retentionExperimentStageStatus.enumValues)[number];

export interface StoredRetentionStage {
  readonly candidate: RetentionStageCandidate;
  status: StageStatus;
  skipReason: string | null;
  processedAt: Temporal.Instant | null;
  notificationId: number | null;
}

interface RetentionEnrollment {
  readonly userId: string;
  readonly variant: RetentionVariant;
  startedAt: Temporal.Instant | null;
}

interface D7Result {
  readonly returnedWithinD7: boolean;
  readonly todoActionWithinD7: boolean;
  readonly measuredAt: Temporal.Instant;
}

function isAfter(candidate: RetentionStageCandidate, cursor: RetentionStageCursor): boolean {
  const order = Temporal.Instant.compare(candidate.stageCreatedAt, cursor.createdAt);
  return order > 0 || (order === 0 && candidate.stageId > cursor.stageId);
}

function byCreation(left: StoredRetentionStage, right: StoredRetentionStage): number {
  const diff = Temporal.Instant.compare(
    left.candidate.stageCreatedAt,
    right.candidate.stageCreatedAt,
  );
  return diff === 0 ? left.candidate.stageId.localeCompare(right.candidate.stageId) : diff;
}

export type RetentionUserProfile = Partial<
  Omit<
    RetentionStageCandidate,
    "assignmentId" | "stageId" | "stageCreatedAt" | "userId" | "variant" | "stage" | "startedAt"
  >
>;

// Drizzle처럼 SCHEDULED이고 결정할 때가 된 단계만 생성 순서로 돌려주고 상태 전이는 한 번만 성공한다.
// 등록·활성화로 만든 단계의 사용자 정보(시간대·언어 등)는 givenUser로 넣은 값, 없으면 fixture 기본값이다
export class InMemoryRetentionRepository extends RetentionRepositoryPort {
  readonly stages: StoredRetentionStage[];
  readonly enrollments: RetentionEnrollment[] = [];
  readonly d7Results = new Map<string, D7Result>();
  readonly dueQueries: Temporal.Instant[] = [];
  // 이 단계를 표시하려 하면 실패한다(발행 도중 오류를 흉내 낸다)
  failingStageIds = new Set<string>();
  readonly #profiles = new Map<string, RetentionUserProfile>();
  readonly #assignmentIdByUser = new Map<string, string>();
  readonly #now: () => Temporal.Instant;
  #sequence = 0;

  constructor(
    candidates: readonly RetentionStageCandidate[] = [],
    now: () => Temporal.Instant = () => Temporal.Instant.fromEpochMilliseconds(Date.now()),
  ) {
    super();
    this.#now = now;
    this.stages = candidates.map((candidate) => ({
      candidate,
      status: "SCHEDULED",
      skipReason: null,
      processedAt: null,
      notificationId: null,
    }));
  }

  async enroll(params: {
    readonly userId: UserId;
    readonly variant: RetentionVariant;
    readonly startedAt: Temporal.Instant | null;
  }): Promise<void> {
    const input = { ...params, userId: params.userId.value };
    if (this.enrollments.some((enrollment) => enrollment.userId === input.userId)) {
      return;
    }
    this.enrollments.push(input);
    this.#sequence += 1;
    this.#assignmentIdByUser.set(input.userId, `retention-assignment-${this.#sequence}`);
    if (input.startedAt != null) {
      this.#createStages(input.userId, input.variant, input.startedAt);
    }
  }

  givenUser(userId: string, profile: RetentionUserProfile = {}): void {
    this.#profiles.set(userId, profile);
  }

  async activate(user: UserId, startedAt: Temporal.Instant): Promise<boolean> {
    const userId = user.value;
    const enrollment = this.enrollments.find((item) => item.userId === userId);
    if (enrollment == null || enrollment.startedAt != null) {
      return false;
    }
    enrollment.startedAt = startedAt;
    this.#createStages(userId, enrollment.variant, startedAt);
    return true;
  }

  async findDueStages(params: {
    readonly dueAt: Temporal.Instant;
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

  async markStageSkipped(
    stageId: string,
    reason: string,
    processedAt: Temporal.Instant,
  ): Promise<boolean> {
    return this.#transition(stageId, { status: "SKIPPED", skipReason: reason, processedAt });
  }

  async markStageOutboxed(stageId: string, processedAt: Temporal.Instant): Promise<boolean> {
    return this.#transition(stageId, { status: "OUTBOXED", skipReason: null, processedAt });
  }

  async linkStageNotification(
    stageId: string,
    notification: NotificationId,
    _linkedAt: Temporal.Instant,
  ): Promise<void> {
    const notificationId = notification.value;
    const stage = this.#require(stageId);
    stage.notificationId = notificationId;
  }

  async recordD7Result(input: {
    readonly assignmentId: string;
    readonly returnedWithinD7: boolean;
    readonly todoActionWithinD7: boolean;
    readonly measuredAt: Temporal.Instant;
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

  // 한 번에 만든 네 단계는 생성 시각이 같고 ID 순서가 생성 순서다
  #createStages(userId: string, variant: RetentionVariant, startedAt: Temporal.Instant): void {
    const assignmentId = this.#assignmentIdByUser.get(userId) ?? userId;
    const stageCreatedAt = this.#now();
    for (const stage of RETENTION_STAGE_NAMES) {
      this.#sequence += 1;
      this.stages.push({
        candidate: createRetentionStageCandidateFixture({
          ...this.#profiles.get(userId),
          assignmentId,
          stageId: `retention-stage-${String(this.#sequence).padStart(6, "0")}`,
          stageCreatedAt,
          userId,
          variant,
          stage,
          startedAt,
        }),
        status: "SCHEDULED",
        skipReason: null,
        processedAt: null,
        notificationId: null,
      });
    }
  }

  #require(stageId: string): StoredRetentionStage {
    const stage = this.stages.find((item) => item.candidate.stageId === stageId);
    if (stage == null) {
      throw new Error(`unknown retention stage ${stageId}`);
    }
    return stage;
  }
}
