import { EVENING_REMINDER_HOUR_RANGE, MORNING_REMINDER_HOUR_RANGE } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { reminderTimeOutOfRange } from "./user-preferences.errors.js";

export interface ReminderHours {
  readonly morningReminderHour?: number;
  readonly eveningReminderHour?: number;
}

/** 아침 리마인더는 오전(0-11), 저녁 리마인더는 오후(12-23)만 허용한다. 주지 않은 값은 검사하지 않는다(PATCH) */
export class ReminderTime extends ValueObject<ReminderHours> {
  static create(hours: ReminderHours): ReminderTime {
    if (
      hours.morningReminderHour != null &&
      hours.morningReminderHour > MORNING_REMINDER_HOUR_RANGE.MAX
    ) {
      throw reminderTimeOutOfRange();
    }
    if (
      hours.eveningReminderHour != null &&
      hours.eveningReminderHour < EVENING_REMINDER_HOUR_RANGE.MIN
    ) {
      throw reminderTimeOutOfRange();
    }
    return new ReminderTime({
      morningReminderHour: hours.morningReminderHour,
      eveningReminderHour: hours.eveningReminderHour,
    });
  }
}
