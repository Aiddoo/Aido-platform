import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

import { localTimeIn, resolveScheduledInstant } from "./todo-calendar.domain-service.js";

export interface TodoScheduleProps {
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  /** 벽시계(HH:mm). 어디서든 그 시각이며 진실은 이 값이다. */
  readonly scheduledLocalTime: string | null;
  /** startDate + 벽시계 + 사용자 시간대로 만든 파생값. 알림과 출시 앱 호환에 쓴다. */
  readonly scheduledTime: Temporal.Instant | null;
  readonly isAllDay: boolean;
}

export interface TodoScheduleInput {
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly scheduledLocalTime: string | null;
  readonly isAllDay: boolean;
  readonly timezone: string;
}

export type TodoSchedulePatch = Partial<
  Pick<TodoScheduleProps, "startDate" | "endDate" | "scheduledLocalTime" | "isAllDay">
>;

export class TodoSchedule extends ValueObject<TodoScheduleProps> {
  static create(input: TodoScheduleInput): TodoSchedule {
    TodoSchedule.#assertDateOrder(input);
    return new TodoSchedule({
      startDate: input.startDate,
      endDate: input.endDate,
      scheduledLocalTime: input.scheduledLocalTime,
      scheduledTime: resolveScheduledInstant(
        input.startDate.toString(),
        input.scheduledLocalTime,
        input.timezone,
      ),
      // 출시 앱은 isAllDay 기본값(true)과 함께 시간을 보내므로 시간이 있으면 시간 일정으로 맞춘다.
      isAllDay: input.scheduledLocalTime == null,
    });
  }

  /** 옛 서버가 시간을 지운 행은 칸이 낡아 있을 수 있어 순간이 없으면 벽시계도 없는 것으로 읽는다. */
  static reconstitute(props: TodoScheduleProps): TodoSchedule {
    return new TodoSchedule({
      ...props,
      scheduledLocalTime: props.scheduledTime == null ? null : props.scheduledLocalTime,
    });
  }

  static #assertDateOrder({
    startDate,
    endDate,
  }: Pick<TodoScheduleProps, "startDate" | "endDate">): void {
    if (endDate != null && Temporal.PlainDate.compare(endDate, startDate) < 0) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { startDate: startDate.toString(), endDate: endDate.toString() },
        { message: "종료 날짜는 시작 날짜보다 빠를 수 없습니다." },
      );
    }
  }

  /** 날짜나 시각을 건드리면 벽시계에서 순간을 다시 만든다. 다른 값만 고치면 순간은 그대로다. */
  patch(partial: TodoSchedulePatch, timezone: string): TodoSchedule {
    // oxlint-disable-next-line aido/no-strict-nullish -- PATCH라 undefined는 기존 값 유지, null은 지우기다
    const keepsTime = partial.scheduledLocalTime === undefined;
    const clearsTime = keepsTime && partial.isAllDay === true;
    const scheduledLocalTime = !keepsTime
      ? (partial.scheduledLocalTime ?? null)
      : clearsTime
        ? null
        : this.localTimeIn(timezone);
    const startDate = partial.startDate ?? this.startDate;
    const rederives = !keepsTime || clearsTime || partial.startDate != null;
    const merged: TodoScheduleProps = {
      startDate,
      // oxlint-disable-next-line aido/no-strict-nullish -- PATCH라 undefined는 기존 값 유지, null은 지우기다
      endDate: partial.endDate !== undefined ? partial.endDate : this.endDate,
      scheduledLocalTime: rederives ? scheduledLocalTime : this.value.scheduledLocalTime,
      scheduledTime: rederives
        ? resolveScheduledInstant(startDate.toString(), scheduledLocalTime, timezone)
        : this.scheduledTime,
      // 시간을 건드린 PATCH만 맞춘다. 저장된 옛 행은 사용자가 고칠 때까지 그대로 읽는다.
      isAllDay:
        keepsTime && partial.isAllDay == null ? this.value.isAllDay : scheduledLocalTime == null,
    };

    // oxlint-disable-next-line aido/no-strict-nullish -- endDate null은 종료일 지우기라 날짜 변경이다
    if (partial.startDate != null || partial.endDate !== undefined) {
      TodoSchedule.#assertDateOrder(merged);
    }
    return new TodoSchedule(merged);
  }

  /** 칸이 빈 옛 행은 사용자가 보던 그대로 순간을 지금 시간대로 읽는다. */
  localTimeIn(timezone: string): string | null {
    const { scheduledLocalTime, scheduledTime } = this.value;
    if (scheduledTime == null) {
      return null;
    }
    return scheduledLocalTime ?? localTimeIn(scheduledTime, timezone);
  }

  get startDate(): Temporal.PlainDate {
    return this.value.startDate;
  }

  get endDate(): Temporal.PlainDate | null {
    return this.value.endDate;
  }

  get scheduledLocalTime(): string | null {
    return this.value.scheduledLocalTime;
  }

  get scheduledTime(): Temporal.Instant | null {
    return this.value.scheduledTime;
  }

  get isAllDay(): boolean {
    return this.value.isAllDay;
  }

  toPrimitives(): TodoScheduleProps {
    return { ...this.value };
  }
}
