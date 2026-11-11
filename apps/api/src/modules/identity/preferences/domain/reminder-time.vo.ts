import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export interface ReminderHours {
  readonly morningReminderHour?: number;
  readonly eveningReminderHour?: number;
}

const MORNING_LAST_HOUR = 11;
const EVENING_FIRST_HOUR = 12;

/** 아침 리마인더는 오전(0-11), 저녁 리마인더는 오후(12-23)만 허용한다. 주지 않은 값은 검사하지 않는다(PATCH) */
export class ReminderTime extends ValueObject<ReminderHours> {
  static create(hours: ReminderHours): ReminderTime {
    if (hours.morningReminderHour != null && hours.morningReminderHour > MORNING_LAST_HOUR) {
      throw new DomainException(ErrorCode.PREFERENCE_1702);
    }
    if (hours.eveningReminderHour != null && hours.eveningReminderHour < EVENING_FIRST_HOUR) {
      throw new DomainException(ErrorCode.PREFERENCE_1702);
    }
    return new ReminderTime({
      morningReminderHour: hours.morningReminderHour,
      eveningReminderHour: hours.eveningReminderHour,
    });
  }
}
