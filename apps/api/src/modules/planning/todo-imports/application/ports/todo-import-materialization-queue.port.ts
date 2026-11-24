import type { TodoImportId } from "../../domain/todo-import-id.vo.js";

// 할 일 만들기 작업을 활성 트랜잭션에 넣는다. 작업은 신호일 뿐이고 상태는 가져오기 행에 있다
export abstract class TodoImportMaterializationQueuePort {
  abstract enqueue(importId: TodoImportId, round: number): Promise<void>;
}
