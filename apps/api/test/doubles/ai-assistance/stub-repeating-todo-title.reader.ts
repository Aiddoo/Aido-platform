import { RepeatingTodoTitleReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";

export class StubRepeatingTodoTitleReader extends RepeatingTodoTitleReaderPort {
  titles: string[] = [];

  async listActiveTitles(): Promise<string[]> {
    return [...this.titles];
  }
}
