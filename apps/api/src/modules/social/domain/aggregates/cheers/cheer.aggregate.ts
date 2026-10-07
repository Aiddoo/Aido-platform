import { AggregateRoot } from "#api/shared/domain/index";

export interface CheerProps {
  id: number;
  senderId: string;
  receiverId: string;
  message: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export class Cheer extends AggregateRoot<CheerProps> {
  static reconstitute(props: CheerProps): Cheer {
    return new Cheer({
      id: props.id,
      senderId: props.senderId,
      receiverId: props.receiverId,
      message: props.message,
      readAt: props.readAt !== null ? new Date(props.readAt) : null,
      createdAt: new Date(props.createdAt),
    });
  }

  get id(): number {
    return this.props.id;
  }

  get senderId(): string {
    return this.props.senderId;
  }

  get receiverId(): string {
    return this.props.receiverId;
  }

  get message(): string | null {
    return this.props.message;
  }

  get readAt(): Date | null {
    return this.props.readAt !== null ? new Date(this.props.readAt) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  isRead(): boolean {
    return this.props.readAt !== null;
  }

  markRead(at: Date): boolean {
    if (this.isRead()) return false;
    this.props.readAt = new Date(at);
    return true;
  }

  isReceivedBy(userId: string): boolean {
    return this.props.receiverId === userId;
  }
}
