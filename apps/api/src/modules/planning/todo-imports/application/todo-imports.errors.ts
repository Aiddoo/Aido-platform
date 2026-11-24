import { ErrorCode } from "@aido/api/errors";
import {
  TODO_IMPORT_LIMITS,
  type TodoImportInvalidReason,
  type TodoImportTargetRejectionReason,
} from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { TodoImportId } from "../domain/todo-import-id.vo.js";

// access가 계산한 featureQuota를 한도 오류 details에 그대로 싣는다. 가져오기는 값을 해석하지 않는다
export type TodoImportFeatureQuota = Readonly<Record<string, unknown>>;

export interface TodoImportTargetRejection {
  readonly targetKey: string;
  readonly reason: TodoImportTargetRejectionReason;
  readonly current?: number;
  readonly expected?: number;
  readonly limit?: number;
}

export function todoImportNotFound(importId: TodoImportId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2304, { importId: importId.value });
}

export function todoImportAlreadyActive(importId: TodoImportId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2301, { importId: importId.value });
}

/** 기간이 요금제 일 수를 넘는다. 앱이 featureQuota로 프리미엄 안내를 띄운다 */
export function todoImportRangeBeyondPlan(
  featureQuota: TodoImportFeatureQuota,
): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2302, { charged: false, featureQuota });
}

export function todoImportTargetsRejected(
  targets: readonly TodoImportTargetRejection[],
): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2303, { targets });
}

export function todoImportInvalid(
  reason: TodoImportInvalidReason,
  index?: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2306, {
    reason,
    ...(index != null && { index }),
  });
}

/** 같은 Idempotency-Key로 본문이 다른 시작을 보냈다 */
export function todoImportRequestMismatch(): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2307);
}

export function todoImportTooManyItems(receivedItemCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_IMPORT_2309, {
    limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT,
    receivedItemCount,
  });
}

/** 새 카테고리를 만들면 카테고리 수 한도를 넘는다. 카테고리 직접 만들기와 같은 코드·details다 */
export function todoImportCategoryLimitReached(
  featureQuota: TodoImportFeatureQuota,
): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_CATEGORY_0857, { charged: false, featureQuota });
}

/**
 * 같은 사용자의 진행 중 가져오기가 이미 있다. 사용자 가져오기 잠금을 지나 겹친 시작을 저장소가 부분 유니크로 알린다.
 * HTTP로 나가지 않고 StartTodoImportUseCase가 받아 먼저 저장된 가져오기로 2301을 낸다
 */
export class TodoImportAlreadyActiveError extends Error {
  constructor() {
    super("Todo import already active");
    this.name = TodoImportAlreadyActiveError.name;
  }
}

export function todoImportAlreadyActiveConflict(): TodoImportAlreadyActiveError {
  return new TodoImportAlreadyActiveError();
}
