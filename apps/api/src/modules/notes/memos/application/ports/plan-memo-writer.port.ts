import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MemoId } from "../../domain/memo-id.vo.js";

// 계획 저장(voice)이 출시 응답에 그대로 싣는 메모라 시각은 ISO 문자열이다
export interface PlanMemo {
  readonly id: number;
  readonly userId: string;
  readonly content: string;
  readonly isPinned: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * 계획을 저장하는 다른 Context가 쓰는 메모 쓰기. 활성 UoW가 있으면 함께 커밋되고 개수 상한은 손으로 만든
 * 메모와 같다. delete는 호출자가 메모 잠금(memo·memo-sort-order)과 소유 확인(findById)을 마친 뒤 부른다.
 */
export abstract class PlanMemoWriterPort {
  abstract create(input: { readonly userId: UserId; readonly content: string }): Promise<PlanMemo>;
  abstract findById(memoId: MemoId, userId: UserId): Promise<PlanMemo | null>;
  abstract delete(memoId: MemoId, userId: UserId): Promise<void>;
}
