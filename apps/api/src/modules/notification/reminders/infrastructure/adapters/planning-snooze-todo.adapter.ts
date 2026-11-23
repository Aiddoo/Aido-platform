import { Injectable } from "@nestjs/common";

import {
  TodoBriefReaderPort,
  type TodoId,
} from "#api/modules/planning/todos/planning-todos-queries.public";

import type { SnoozeTodoReaderPort } from "../../application/ports/snooze-todo.reader.port.js";
import type { SnoozeTodoReadModel } from "../../application/read-models/scheduler.read-model.js";

/** 다시 알림을 걸 할 일의 주인과 완료 여부를 planning 조회 포트로 읽는다. */
@Injectable()
export class PlanningSnoozeTodoAdapter implements SnoozeTodoReaderPort {
  readonly #todoBriefReader: Pick<TodoBriefReaderPort, "listByIds">;

  constructor(todoBriefReader: TodoBriefReaderPort) {
    this.#todoBriefReader = todoBriefReader;
  }

  async findTodo(todoId: TodoId): Promise<SnoozeTodoReadModel | null> {
    const [todo] = await this.#todoBriefReader.listByIds([todoId]);
    if (todo == null) {
      return null;
    }
    return { ownerId: todo.ownerId, completed: todo.completed };
  }
}
