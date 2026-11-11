import type { UserLocaleMap } from "../read-models/scheduler.read-model.js";

export abstract class SchedulerPreferenceReaderPort {
  /** 저장된 시간대 중 런타임이 아는 것만, 캐시를 거쳐 읽는다. */
  abstract findActiveTimezones(): Promise<string[]>;
  /** 설정이 없는 사용자는 결과에 없다. */
  abstract findUserLocales(userIds: string[]): Promise<UserLocaleMap>;
}
