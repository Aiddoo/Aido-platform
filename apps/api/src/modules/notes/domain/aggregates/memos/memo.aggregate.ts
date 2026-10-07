import { AggregateRoot } from "#api/shared/domain/index";

import type { MemoRecord } from "../../records/memos/memo.record.js";
import { MemoContent } from "../../value-objects/memos/memo-content.vo.js";

interface MemoProps {
  id: number;
  userId: string;
  content: MemoContent;
  isPinned: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Memo extends AggregateRoot<MemoProps> {
  static reconstitute(props: MemoRecord): Memo {
    return new Memo({
      id: props.id,
      userId: props.userId,
      content: MemoContent.of(props.content),
      isPinned: props.isPinned,
      sortOrder: props.sortOrder,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): number {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get content(): MemoContent {
    return this.props.content;
  }

  get isPinned(): boolean {
    return this.props.isPinned;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get snapshot(): MemoRecord {
    return {
      id: this.props.id,
      userId: this.props.userId,
      content: this.props.content.value,
      isPinned: this.props.isPinned,
      sortOrder: this.props.sortOrder,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  rename(content: string): void {
    this.props.content = MemoContent.of(content);
  }

  setPinned(isPinned: boolean): void {
    this.props.isPinned = isPinned;
  }

  toTodoTitle(): string {
    return this.props.content.toTodoTitle();
  }
}
