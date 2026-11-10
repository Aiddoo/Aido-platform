import { ErrorCode } from "@aido/api/errors";

import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";
import { DomainException, ValueObject } from "#api/shared/domain/index";

export interface TodoScheduleProps {
  startDate: Date;
  endDate: Date | null;
  /** 벽시계(HH:mm). 어디서든 그 시각이며 진실은 이 값이다. */
  scheduledLocalTime: string | null;
  /** startDate + 벽시계 + 사용자 시간대로 만든 파생값. 알림과 출시 앱 호환에 쓴다. */
  scheduledTime: Date | null;
  isAllDay: boolean;
}

export interface TodoScheduleInput {
  startDate: Date;
  endDate: Date | null;
  scheduledLocalTime: string | null;
  isAllDay: boolean;
  timezone: string;
}

export type TodoSchedulePatch = Partial<
  Pick<TodoScheduleProps, "startDate" | "endDate" | "scheduledLocalTime" | "isAllDay">
>;

/** 할 일의 순간을 만드는 유일한 함수다. 경로마다 시간대를 해석하지 않는다. */
export function resolveScheduledInstant(
  date: string,
  localTime: string | null,
  timezone: string,
): Date | null {
  return localTime == null ? null : parseLocalDateTime(date, localTime, timezone);
}

export class TodoSchedule extends ValueObject<TodoScheduleProps> {
  constructor(props: TodoScheduleProps) {
    super({
      startDate: new Date(props.startDate),
      endDate: props.endDate == null ? null : new Date(props.endDate),
      scheduledLocalTime: props.scheduledLocalTime,
      scheduledTime: props.scheduledTime == null ? null : new Date(props.scheduledTime),
      isAllDay: props.isAllDay,
    });
  }

  static create(input: TodoScheduleInput): TodoSchedule {
    TodoSchedule.#assertDateOrder(input);
    return new TodoSchedule({
      startDate: input.startDate,
      endDate: input.endDate,
      scheduledLocalTime: input.scheduledLocalTime,
      scheduledTime: resolveScheduledInstant(
        toDateString(input.startDate),
        input.scheduledLocalTime,
        input.timezone,
      ),
      // 출시 앱은 isAllDay 기본값(true)과 함께 시간을 보내므로 시간이 있으면 시간 일정으로 맞춘다.
      isAllDay: input.scheduledLocalTime == null,
    });
  }

  static #assertDateOrder({
    startDate,
    endDate,
  }: Pick<TodoScheduleProps, "startDate" | "endDate">) {
    if (endDate != null && endDate < startDate) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { startDate, endDate },
        "종료 날짜는 시작 날짜보다 빠를 수 없습니다.",
      );
    }
  }

  /** 옛 서버가 시간을 지운 행은 칸이 낡아 있을 수 있어 순간이 없으면 벽시계도 없는 것으로 읽는다. */
  static reconstitute(props: TodoScheduleProps): TodoSchedule {
    return new TodoSchedule({
      ...props,
      scheduledLocalTime: props.scheduledTime == null ? null : props.scheduledLocalTime,
    });
  }

  /** 날짜나 시각을 건드리면 벽시계에서 순간을 다시 만든다. 다른 값만 고치면 순간은 그대로다. */
  patch(partial: TodoSchedulePatch, timezone: string): TodoSchedule {
    // nullish-strict: PATCH라 undefined는 기존 값 유지, null은 지우기다
    const keepsTime = partial.scheduledLocalTime === undefined;
    const clearsTime = keepsTime && partial.isAllDay === true;
    const scheduledLocalTime = !keepsTime
      ? (partial.scheduledLocalTime ?? null)
      : clearsTime
        ? null
        : this.getLocalTimeIn(timezone);
    const startDate = partial.startDate ?? this.getStartDate();
    const rederives = !keepsTime || clearsTime || partial.startDate != null;
    const merged: TodoScheduleProps = {
      startDate,
      // nullish-strict: PATCH라 undefined는 기존 값 유지, null은 지우기다
      endDate: partial.endDate !== undefined ? partial.endDate : this.getEndDate(),
      scheduledLocalTime: rederives ? scheduledLocalTime : this.value.scheduledLocalTime,
      scheduledTime: rederives
        ? resolveScheduledInstant(toDateString(startDate), scheduledLocalTime, timezone)
        : this.getScheduledTime(),
      // 시간을 건드린 PATCH만 맞춘다. 저장된 옛 행은 사용자가 고칠 때까지 그대로 읽는다.
      isAllDay:
        keepsTime && partial.isAllDay == null ? this.value.isAllDay : scheduledLocalTime == null,
    };

    // nullish-strict: endDate null은 종료일 지우기라 날짜 변경이다
    if (partial.startDate != null || partial.endDate !== undefined) {
      TodoSchedule.#assertDateOrder(merged);
    }
    return new TodoSchedule(merged);
  }

  /** 칸이 빈 옛 행은 사용자가 보던 그대로 순간을 지금 시간대로 읽는다. */
  getLocalTimeIn(timezone: string): string | null {
    const { scheduledLocalTime, scheduledTime } = this.value;
    if (scheduledTime == null) {
      return null;
    }
    return scheduledLocalTime ?? toLocalTimeString(scheduledTime, timezone);
  }

  getStartDate(): Date {
    return new Date(this.value.startDate);
  }

  getEndDate(): Date | null {
    return this.value.endDate ? new Date(this.value.endDate) : null;
  }

  getScheduledLocalTime(): string | null {
    return this.value.scheduledLocalTime;
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
      scheduledLocalTime: this.value.scheduledLocalTime,
      scheduledTime: this.getScheduledTime(),
      isAllDay: this.value.isAllDay,
    };
  }
}
