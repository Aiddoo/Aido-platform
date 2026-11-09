import type { Memo } from "@aido/api";

/**
 * 계획의 메모를 저장한다. 활성 UoW가 있으면 함께 커밋되고 개수 상한은 손으로 만든 메모와 같다.
 * delete는 호출자가 그 메모의 잠금과 소유 확인(findById)을 마친 뒤 부른다.
 */
export interface PlanMemoWriterPort {
  create(input: { readonly userId: string; readonly content: string }): Promise<Memo>;
  findById(memoId: number, userId: string): Promise<Memo | null>;
  delete(memoId: number, userId: string): Promise<void>;
}
