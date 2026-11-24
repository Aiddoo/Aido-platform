import type {
  ImportAccountKind,
  ImportEventRecord,
  ImportRecordTime,
} from '@src/core/ports/todo-import-source';
import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { fromEpochMs, type Instant, toEpochMs, toInstant } from '@src/shared/date/instant';
import { getStartOfDateKey, toDateKey } from '@src/shared/date/zoned';

export type HashText = (text: string) => Promise<string>;

export interface CalendarEventFields {
  id: string;
  calendarId: string;
  title: string | null;
  startDate: string | Date;
  endDate: string | Date;
  allDay: boolean;
  status: string | null;
}

// Google이 만들어 주는 가상 캘린더(공휴일·연락처 생일·주 번호)와 URL로 구독한 캘린더의 소유 계정 꼴이다
const GOOGLE_HOLIDAY_OWNER_SUFFIX = '#holiday@group.v.calendar.google.com';
const GOOGLE_BIRTHDAY_OWNER_SUFFIX = '#contacts@group.v.calendar.google.com';
const GOOGLE_SUBSCRIBED_OWNER_SUFFIXES = [
  '@group.v.calendar.google.com',
  '@import.calendar.google.com',
] as const;
// CalendarContract.ACCOUNT_TYPE_LOCAL
const ANDROID_LOCAL_ACCOUNT_TYPE = 'LOCAL';

// iOS는 Google 계정의 공휴일 캘린더를 일반 CalDAV로 준다. 남이 공유한 읽기 전용 캘린더와 가르려고 이름까지 본다
const HOLIDAY_TITLE_PATTERN = /holiday|휴일|祝日|节假日|節假日|feiertag|férié|festivo|feriado/i;

export function getIosAccountKind({
  calendarType,
  title,
  allowsModifications,
}: {
  calendarType: string | null;
  title: string;
  allowsModifications: boolean;
}): ImportAccountKind {
  if (calendarType === 'caldav' && !allowsModifications && HOLIDAY_TITLE_PATTERN.test(title)) {
    return 'holidays';
  }
  // iCloud·Google 계정은 CalDAV로 붙는다
  const accountKinds: Partial<Record<string, ImportAccountKind>> = {
    local: 'local',
    caldav: 'cloud',
    mobileme: 'cloud',
    exchange: 'exchange',
    subscribed: 'subscribed',
    birthdays: 'birthdays',
  };
  return accountKinds[calendarType ?? ''] ?? 'other';
}

// Android는 캘린더 종류를 주지 않아 계정 종류(com.google 등)와 소유 계정 꼴로 가린다
export function getAndroidAccountKind({
  accountType,
  ownerAccount,
}: {
  accountType: string | null;
  ownerAccount: string | null;
}): ImportAccountKind {
  const owner = ownerAccount?.toLowerCase() ?? '';
  const type = accountType?.toLowerCase() ?? '';

  if (owner.endsWith(GOOGLE_HOLIDAY_OWNER_SUFFIX) || type.includes('holiday')) {
    return 'holidays';
  }
  if (owner.endsWith(GOOGLE_BIRTHDAY_OWNER_SUFFIX) || type.includes('birthday')) {
    return 'birthdays';
  }
  if (GOOGLE_SUBSCRIBED_OWNER_SUFFIXES.some((suffix) => owner.endsWith(suffix))) {
    return 'subscribed';
  }
  if (accountType === ANDROID_LOCAL_ACCOUNT_TYPE) {
    return 'local';
  }
  if (type.includes('exchange') || type.includes('outlook')) {
    return 'exchange';
  }
  if (type !== '') {
    return 'cloud';
  }
  return 'other';
}

export function buildCollectionKey(calendarId: string, hashText: HashText): Promise<string> {
  return hashText(calendarId);
}

function toCanonicalInstant(value: string | Date): Instant {
  return fromEpochMs(typeof value === 'string' ? toEpochMs(toInstant(value)) : value.getTime());
}

// iOS는 기기 시간대 자정, Android는 UTC 자정으로 종일 일정을 주므로 어댑터가 플랫폼에 맞는 시간대를 넘긴다
export function toAllDayTime({
  startsAt,
  endsAt,
  timezone,
}: {
  startsAt: Instant;
  endsAt: Instant;
  timezone: string;
}): ImportRecordTime {
  const startDate = toDateKey(startsAt, timezone);
  const endDate = toDateKey(endsAt, timezone);
  // iOS 종일 일정의 끝은 마지막 날 23:59:59라 자정이 아닌 끝은 다음 날을 배타적 끝으로 삼는다
  const isEndAtMidnight = toEpochMs(getStartOfDateKey(endDate, timezone)) === toEpochMs(endsAt);
  const endDateExclusive = isEndAtMidnight ? endDate : addDaysToDateKey(endDate, 1);

  return {
    kind: 'allDay',
    startDate,
    endDateExclusive:
      diffDateKeysInDays(startDate, endDateExclusive) > 0
        ? endDateExclusive
        : addDaysToDateKey(startDate, 1),
  };
}

function toRecordTime(event: CalendarEventFields, allDayTimezone: string): ImportRecordTime {
  const startsAt = toCanonicalInstant(event.startDate);
  const endsAt = toCanonicalInstant(event.endDate);
  if (event.allDay) {
    return toAllDayTime({ startsAt, endsAt, timezone: allDayTimezone });
  }
  return { kind: 'timed', startsAt, endsAt };
}

// 종일 일정은 날짜로 회차를 가려 기기 시간대가 바뀌어도 같은 키가 된다
function getOccurrenceStart(time: ImportRecordTime): string {
  return time.kind === 'allDay' ? time.startDate : time.startsAt;
}

// iOS 네이티브는 "cancelled", Android는 "canceled"로 준다(expo-calendar 58.0.8)
function isCanceledStatus(status: string | null): boolean {
  return status === 'canceled' || status === 'cancelled';
}

export async function toImportEventRecord({
  event,
  collectionKey,
  allDayTimezone,
  hashText,
}: {
  event: CalendarEventFields;
  collectionKey: string;
  allDayTimezone: string;
  hashText: HashText;
}): Promise<ImportEventRecord> {
  const time = toRecordTime(event, allDayTimezone);
  // 반복 일정은 회차마다 같은 일정 id를 주므로 회차 시작으로 가른다
  const occurrenceKey = await hashText(
    `${event.calendarId}:${event.id}:${getOccurrenceStart(time)}`,
  );

  return {
    collectionKey,
    occurrenceKey,
    title: event.title === '' ? null : event.title,
    time,
    isCanceled: isCanceledStatus(event.status),
  };
}
