import type { AppLogger } from '@src/core/ports/app-logger';
import type { OsPermission } from '@src/core/ports/os-permission';
import type {
  ImportCollectionRecord,
  ReadEventsInput,
  TodoImportSource,
} from '@src/core/ports/todo-import-source';
import { toInstant } from '@src/shared/date/instant';
import { instantToDate } from '@src/shared/date/native-date';
import { compact } from 'es-toolkit';
import * as Calendar from 'expo-calendar';
import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync } from 'expo-crypto';
import { PermissionsAndroid } from 'react-native';

import { getDeviceSystemTimezone } from '../localization/app-timezone';
import { toOsPermission } from '../permission/to-os-permission';
import {
  buildCollectionKey,
  type CalendarEventFields,
  getAndroidAccountKind,
  getIosAccountKind,
  toImportEventPreview,
  toImportEventRecord,
} from './calendar-import-record';
import { CALENDAR_LOG_EVENT } from './calendar-log-events';

const ANDROID_ALL_DAY_TIMEZONE = 'UTC';

function hashSha256(text: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, text, { encoding: CryptoEncoding.HEX });
}

// expo-calendar는 Android에서 READ·WRITE를 함께 보고 둘 다 허용돼야 granted로 준다. WRITE를 막았으므로 READ만 직접 다룬다
async function readAndroidPermission(): Promise<OsPermission> {
  const isGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALENDAR);
  // Android는 묻기 전에는 영구 거절 여부를 알려 주지 않아 허용 전에는 다시 물을 수 있는 상태로 본다
  return isGranted
    ? { status: 'granted', canAskAgain: true }
    : { status: 'undetermined', canAskAgain: true };
}

async function requestAndroidPermission(): Promise<OsPermission> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALENDAR);
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return { status: 'granted', canAskAgain: true };
  }
  return {
    status: 'denied',
    canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  };
}

function getAccountKind(calendar: Calendar.ExpoCalendar) {
  if (process.env.EXPO_OS === 'android') {
    return getAndroidAccountKind({
      // Android는 계정 이름이 없는 캘린더의 source를 비워 준다
      accountType: calendar.source?.type ?? null,
      ownerAccount: calendar.ownerAccount ?? null,
    });
  }
  return getIosAccountKind({
    calendarType: calendar.type ?? null,
    title: calendar.title,
    allowsModifications: calendar.allowsModifications,
  });
}

// Android는 캘린더 앱에서 숨긴 캘린더의 일정을 돌려주지 않는다(Instances VISIBLE = 1)
function isReadable(calendar: Calendar.ExpoCalendar): boolean {
  return calendar.isVisible !== false;
}

function toCalendarEventFields(event: Calendar.ExpoCalendarEvent): CalendarEventFields {
  return {
    id: event.id,
    calendarId: event.calendarId,
    // 타입과 달리 Android는 제목·상태가 없는 일정을 null로 준다
    title: event.title ?? null,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    status: event.status ?? null,
  };
}

export function createExpoCalendarTodoImportSource(logger: AppLogger): TodoImportSource {
  let calendarIdsByCollectionKey = new Map<string, string>();

  async function listCollections() {
    const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const entries = await Promise.all(
      calendars.filter(isReadable).map(async (calendar) => {
        const record: ImportCollectionRecord = {
          collectionKey: await buildCollectionKey(calendar.id, hashSha256),
          title: calendar.title,
          color: calendar.color ?? null,
          accountName: calendar.source?.name ?? null,
          accountKind: getAccountKind(calendar),
        };
        return { calendarId: calendar.id, record };
      }),
    );
    calendarIdsByCollectionKey = new Map(
      entries.map(({ calendarId, record }) => [record.collectionKey, calendarId]),
    );
    return entries.map(({ record }) => record);
  }

  // 앱을 다시 켜 이어 가져오면 목록을 읽기 전이라 모르는 키가 있으면 한 번 다시 읽는다
  async function resolveCalendars(collectionKeys: readonly string[]) {
    if (collectionKeys.some((key) => !calendarIdsByCollectionKey.has(key))) {
      await listCollections();
    }
    return collectionKeys.flatMap((collectionKey) => {
      const calendarId = calendarIdsByCollectionKey.get(collectionKey);
      return calendarId == null ? [] : [{ collectionKey, calendarId }];
    });
  }

  async function listEventFields({ collectionKeys, startsAt, endsAt }: ReadEventsInput) {
    const calendars = await resolveCalendars(collectionKeys);
    // 빈 목록을 넘기면 Android는 모든 캘린더의 일정을 돌려준다
    if (calendars.length === 0) {
      return { entries: [], allDayTimezone: getAllDayTimezone() };
    }
    const collectionKeysByCalendarId = new Map(
      calendars.map(({ collectionKey, calendarId }) => [calendarId, collectionKey]),
    );
    const events = await Calendar.listEvents(
      calendars.map(({ calendarId }) => calendarId),
      instantToDate(toInstant(startsAt)),
      instantToDate(toInstant(endsAt)),
    );
    const entries = events.flatMap((event) => {
      const collectionKey = collectionKeysByCalendarId.get(event.calendarId);
      return collectionKey == null ? [] : [{ event: toCalendarEventFields(event), collectionKey }];
    });
    return { entries, allDayTimezone: getAllDayTimezone() };
  }

  // 일정 하나를 읽지 못해도 나머지는 가져온다. 로그에는 개수만 남긴다
  function dropUnreadable<T>(records: readonly (T | null)[]): T[] {
    const readable = compact(records);
    const skippedCount = records.length - readable.length;
    if (skippedCount > 0) {
      logger.warn(CALENDAR_LOG_EVENT.UNREADABLE_EVENTS_SKIPPED, { total: skippedCount });
    }
    return readable;
  }

  return {
    getPermission: async () => {
      if (process.env.EXPO_OS === 'android') {
        return readAndroidPermission();
      }
      return toOsPermission(await Calendar.getCalendarPermissions());
    },
    requestPermission: async () => {
      if (process.env.EXPO_OS === 'android') {
        return requestAndroidPermission();
      }
      return toOsPermission(await Calendar.requestCalendarPermissions());
    },
    listCollections,
    previewEvents: async (input) => {
      const { entries, allDayTimezone } = await listEventFields(input);
      return dropUnreadable(
        entries.map((entry) => toImportEventPreview({ ...entry, allDayTimezone })),
      );
    },
    readEvents: async (input) => {
      const { entries, allDayTimezone } = await listEventFields(input);
      return dropUnreadable(
        await Promise.all(
          entries.map((entry) =>
            toImportEventRecord({ ...entry, allDayTimezone, hashText: hashSha256 }),
          ),
        ),
      );
    },
  };
}

function getAllDayTimezone() {
  return process.env.EXPO_OS === 'android' ? ANDROID_ALL_DAY_TIMEZONE : getDeviceSystemTimezone();
}
