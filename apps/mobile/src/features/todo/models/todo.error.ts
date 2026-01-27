export class TodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TodoError';
  }

  static invalidResponse(): TodoError {
    return new TodoError('잘못된 응답 형식이에요');
  }

  static notFound(): TodoError {
    return new TodoError('할 일을 찾을 수 없어요');
  }
}
