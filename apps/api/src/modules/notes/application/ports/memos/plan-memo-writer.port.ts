import type { Memo } from "@aido/api";

export const PLAN_MEMO_WRITER = Symbol("PLAN_MEMO_WRITER");

/**
 * 계획을 저장하는 다른 Context가 쓰는 메모 쓰기. 활성 UoW가 있으면 함께 커밋되고 개수 상한은 손으로 만든
 * 메모와 같다. delete는 호출자가 MutationLockKeys.memo 잠금과 소유 확인(findById)을 마친 뒤 부른다.
 */
export interface PlanMemoWriterPort {
  create(input: { readonly userId: string; readonly content: string }): Promise<Memo>;
  findById(memoId: number, userId: string): Promise<Memo | null>;
  delete(memoId: number): Promise<void>;
}
