import type { RetentionVariant } from "../../domain/retention.constants.js";
import type {
  RetentionStageCandidate,
  RetentionStageCursor,
} from "../read-models/retention-stage-candidate.read-model.js";

export abstract class RetentionRepositoryPort {
  // 이미 등록한 사용자면 바꾸지 않는다. startedAt이 있으면 네 단계를 함께 만든다
  abstract enroll(input: {
    readonly userId: string;
    readonly variant: RetentionVariant;
    readonly startedAt: Date | null;
  }): Promise<void>;
  abstract activate(userId: string, startedAt: Date): Promise<boolean>;
  // dueAt까지 결정할 때가 된 SCHEDULED 단계를 생성 순서로 읽는다. 처리 시각 구간이 아니라 상태로 고르므로 늦은 실행도 빠뜨리지 않는다
  abstract findDueStages(params: {
    readonly dueAt: Date;
    readonly after?: RetentionStageCursor;
    readonly limit: number;
  }): Promise<RetentionStageCandidate[]>;
  abstract markStageSkipped(stageId: string, reason: string, processedAt: Date): Promise<boolean>;
  // 다른 실행이 먼저 처리한 단계면 false다. 발행과 같은 UnitOfWork 안에서 호출한다
  abstract markStageOutboxed(stageId: string, processedAt: Date): Promise<boolean>;
  abstract linkStageNotification(stageId: string, notificationId: number): Promise<void>;
  abstract recordD7Result(input: {
    readonly assignmentId: string;
    readonly returnedWithinD7: boolean;
    readonly todoActionWithinD7: boolean;
    readonly measuredAt: Date;
  }): Promise<void>;
}
