export interface MemoRecord {
  readonly id: number;
  readonly userId: string;
  readonly content: string;
  readonly isPinned: boolean;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
