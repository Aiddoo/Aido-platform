import { isSameDay } from "#api/shared/domain/date/utils/compare";

export interface NudgeTargetTodoProps {
  ownerId: string;
  visibility: string;
  startDate: Date;
  endDate: Date | null;
}

export class NudgeTargetTodo {
  private constructor(private readonly props: NudgeTargetTodoProps) {}

  static of(props: NudgeTargetTodoProps): NudgeTargetTodo {
    return new NudgeTargetTodo({
      ...props,
      startDate: new Date(props.startDate),
      endDate: props.endDate !== null ? new Date(props.endDate) : null,
    });
  }

  isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  isPublic(): boolean {
    return this.props.visibility === "PUBLIC";
  }

  isActiveOn(today: Date): boolean {
    if (this.props.endDate !== null) {
      return this.props.startDate <= today && today <= this.props.endDate;
    }
    return isSameDay(this.props.startDate, today);
  }
}
