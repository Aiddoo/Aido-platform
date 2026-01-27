import type {
  AiUsageResponse,
  CreateTodoInput,
  GetTodosQuery,
  ParseTodoResponse,
  Todo,
  TodoListResponse,
  ToggleTodoCompleteInput,
} from '@aido/validators';

export interface TodoRepository {
  getTodos(params: GetTodosQuery): Promise<TodoListResponse>;
  toggleTodoComplete(todoId: number, body: ToggleTodoCompleteInput): Promise<Todo>;
  createTodo(params: CreateTodoInput): Promise<Todo>;
  parseTodo(text: string): Promise<ParseTodoResponse>;
  getAiUsage(): Promise<AiUsageResponse>;
}
