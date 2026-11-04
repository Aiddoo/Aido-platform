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
      endDate: props.endDate == null ? null : new Date(props.endDate),
      scheduledTime: props.scheduledTime == null ? null : new Date(props.scheduledTime),
      isAllDay: props.isAllDay,
    });
  }

  static create(props: TodoScheduleProps): TodoSchedule {
    TodoSchedule.#assertDateOrder(props);
    // 출시 앱은 isAllDay 기본값(true)과 함께 시간을 보내므로 시간이 있으면 시간 일정으로 맞춘다.
    return new TodoSchedule({ ...props, isAllDay: props.scheduledTime == null });
  }

  static #assertDateOrder({ startDate, endDate }: TodoScheduleProps): void {
    if (endDate != null && endDate < startDate) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { startDate, endDate },
        "종료 날짜는 시작 날짜보다 빠를 수 없습니다.",
      );
    }
  }

  static reconstitute(props: TodoScheduleProps): TodoSchedule {
    return new TodoSchedule(props);
  }

  patch(partial: Partial<TodoScheduleProps>): TodoSchedule {
    // nullish-strict: PATCH라 undefined는 기존 값 유지, null은 지우기다
    const keepsTime = partial.scheduledTime === undefined;
    const scheduledTime = !keepsTime
      ? (partial.scheduledTime ?? null)
      : partial.isAllDay === true
        ? null
        : this.getScheduledTime();
    const merged: TodoScheduleProps = {
      startDate: partial.startDate ?? this.getStartDate(),
      // nullish-strict: PATCH라 undefined는 기존 값 유지, null은 지우기다
      endDate: partial.endDate !== undefined ? partial.endDate : this.getEndDate(),
      scheduledTime,
      // 시간을 건드린 PATCH만 맞춘다. 저장된 옛 행은 사용자가 고칠 때까지 그대로 읽는다.
      isAllDay: keepsTime && partial.isAllDay == null ? this.value.isAllDay : scheduledTime == null,
    };

    // nullish-strict: endDate null은 종료일 지우기라 날짜 변경이다
    if (partial.startDate != null || partial.endDate !== undefined) {
      TodoSchedule.#assertDateOrder(merged);
    }
    return new TodoSchedule(merged);
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
