import {
  type SingleTodoCountQuery,
  SingleTodoCountReaderPort,
} from "#api/modules/planning/todos/planning-todos-queries.public";

export class StubSingleTodoCountReader extends SingleTodoCountReaderPort {
  count = 3;
  readonly queries: SingleTodoCountQuery[] = [];

  async countSingleTodos(query: SingleTodoCountQuery): Promise<number> {
    this.queries.push(query);
    return this.count;
  }
}
