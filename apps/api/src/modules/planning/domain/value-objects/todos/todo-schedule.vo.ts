import { ErrorCode } from "@aido/api/errors";

import { DomainException, ValueObject } from "#api/shared/domain/index";

export interface TodoScheduleProps {
  startDate: Date;
  endDate: Date | null;
  scheduledTime: Date | null;
  isAllDay: boolean;
}

export class TodoSchedule extends ValueObject<TodoScheduleProps> {
  private constructor(props: TodoScheduleProps) {
    super({
      startDate: new Date(props.startDate),
      endDate: props.endDate === null ? null : new Date(props.endDate),
      scheduledTime: props.scheduledTime === null ? null : new Date(props.scheduledTime),
      isAllDay: props.isAllDay,
    });
  }

  static create(props: TodoScheduleProps): TodoSchedule {
    if (props.endDate !== null && props.endDate < props.startDate) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { startDate: props.startDate, endDate: props.endDate },
        "종료 날짜는 시작 날짜보다 빠를 수 없습니다.",
      );
    }
    return new TodoSchedule(props);
  }

  static reconstitute(props: TodoScheduleProps): TodoSchedule {
    return new TodoSchedule(props);
  }

  patch(partial: Partial<TodoScheduleProps>): TodoSchedule {
    const merged: TodoScheduleProps = {
      startDate: partial.startDate ?? this.getStartDate(),
      endDate: partial.endDate !== undefined ? partial.endDate : this.getEndDate(),
      scheduledTime:
        partial.scheduledTime !== undefined ? partial.scheduledTime : this.getScheduledTime(),
      isAllDay: partial.isAllDay ?? this.value.isAllDay,
    };

    const touchesDates = partial.startDate !== undefined || partial.endDate !== undefined;
    if (touchesDates) {
      return TodoSchedule.create(merged);
    }
    return TodoSchedule.reconstitute(merged);
  }

  getStartDate(): Date {
    return new Date(this.value.startDate);
  }

  getEndDate(): Date | null {
    return this.value.endDate ? new Date(this.value.endDate) : null;
  }

  getScheduledTime(): Date | null {
    return this.value.scheduledTime ? new Date(this.value.scheduledTime) : null;
  }

  isAllDay(): boolean {
    return this.value.isAllDay;
  }

  override getValue(): TodoScheduleProps {
    return {
      startDate: this.getStartDate(),
      endDate: this.getEndDate(),
      scheduledTime: this.getScheduledTime(),
      isAllDay: this.value.isAllDay,
    };
  }
}
