export interface TodoCommentState {
  readonly id: string;
  readonly todoId: number;
  readonly authorId: string;
  readonly parentId: string | null;
  readonly rootId: string | null;
  readonly path: readonly string[];
  readonly content: string | null;
  readonly deletedAt: Date | null;
  readonly editedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
