import type { OsPermission } from './os-permission';

// 종일 일정은 시간대 없는 날짜(끝은 배타적), 시각 일정은 ISO 8601 순간이다. 날짜·시각으로 바꾸는 일은 가져오기 시간대를 아는 모델이 한다
export type ImportRecordTime =
  | { kind: 'allDay'; startDate: string; endDateExclusive: string }
  | { kind: 'timed'; startsAt: string; endsAt: string };

export type ImportAccountKind =
  | 'local'
  | 'cloud'
  | 'exchange'
  | 'subscribed'
  | 'birthdays'
  | 'holidays'
  | 'other';

// 키는 원래 id의 sha256 hex다. 캘린더 id가 이메일일 수 있어 원래 id는 어댑터 밖으로 나가지 않는다
export interface ImportCollectionRecord {
  collectionKey: string;
  title: string;
  color: string | null;
  accountName: string | null;
  accountKind: ImportAccountKind;
}

export interface ImportEventRecord {
  collectionKey: string;
  occurrenceKey: string;
  title: string | null;
  time: ImportRecordTime;
  isCanceled: boolean;
}

export interface TodoImportSource {
  getPermission(): Promise<OsPermission>;
  requestPermission(): Promise<OsPermission>;
  listCollections(): Promise<ImportCollectionRecord[]>;
  // core는 shared의 Instant를 모르므로 ISO 8601 순간 문자열로 받는다. 반복 일정은 회차마다 하나다
  readEvents(input: {
    collectionKeys: readonly string[];
    startsAt: string;
    endsAt: string;
  }): Promise<ImportEventRecord[]>;
}
