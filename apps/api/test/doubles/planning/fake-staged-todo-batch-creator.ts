import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import {
  type StagedTodoBatch,
  StagedTodoBatchCreatorPort,
  type StageTodoBatchInput,
  type TodoBatchOutcome,
} from "#api/modules/planning/todos/planning-todos.public";

/**
 * 할 일 일괄 만들기의 결과 규칙만 흉내 낸다. 카테고리마다 남은 자리(remainingByCategory)를 넘으면 CAPACITY,
 * 제목이 비면 INVALID로 거절하고, 받은 입력(시간대·초안)을 남긴다.
 */
export class FakeStagedTodoBatchCreator extends StagedTodoBatchCreatorPort {
  readonly calls: StageTodoBatchInput[] = [];
  readonly remainingByCategory = new Map<number, number>();
  #nextTodoId = 1000;

  async stageMany(input: StageTodoBatchInput): Promise<StagedTodoBatch> {
    this.calls.push(input);
    const outcomes = input.drafts.map((draft): TodoBatchOutcome => {
      if (draft.title.trim().length === 0) {
        return { kind: "rejected", key: draft.key, reason: "INVALID" };
      }
      const remaining = this.remainingByCategory.get(draft.categoryId.value);
      if (remaining != null && remaining <= 0) {
        return { kind: "rejected", key: draft.key, reason: "CAPACITY" };
      }
      if (remaining != null) {
        this.remainingByCategory.set(draft.categoryId.value, remaining - 1);
      }
      this.#nextTodoId += 1;
      return { kind: "created", key: draft.key, todoId: TodoId.reconstitute(this.#nextTodoId) };
    });
    return {
      outcomes,
      afterCommit: async () => undefined,
      afterCommitKey: `todo-batch:${input.userId.value}`,
    };
  }
}
