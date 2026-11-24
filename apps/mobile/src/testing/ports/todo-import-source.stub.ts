import type { OsPermission } from '@src/core/ports/os-permission';
import type {
  ImportCollectionRecord,
  ImportEventRecord,
  TodoImportSource,
} from '@src/core/ports/todo-import-source';

import { mockMethod } from '../mock-method';

const PERSONAL_COLLECTION_KEY = 'a'.repeat(64);
const HOLIDAY_COLLECTION_KEY = 'b'.repeat(64);

const DEFAULT_COLLECTIONS: readonly ImportCollectionRecord[] = [
  {
    collectionKey: PERSONAL_COLLECTION_KEY,
    title: '개인',
    color: '#FF6B43',
    accountName: 'iCloud',
    accountKind: 'cloud',
  },
  {
    collectionKey: HOLIDAY_COLLECTION_KEY,
    title: '대한민국 공휴일',
    color: '#34C759',
    accountName: null,
    accountKind: 'holidays',
  },
];

const DEFAULT_EVENTS: readonly ImportEventRecord[] = [
  {
    collectionKey: PERSONAL_COLLECTION_KEY,
    occurrenceKey: '1'.repeat(64),
    title: '팀 회의',
    time: {
      kind: 'timed',
      startsAt: '2026-11-25T01:00:00.000Z',
      endsAt: '2026-11-25T02:00:00.000Z',
    },
    isCanceled: false,
  },
  {
    collectionKey: PERSONAL_COLLECTION_KEY,
    occurrenceKey: '2'.repeat(64),
    title: null,
    time: { kind: 'allDay', startDate: '2026-11-26', endDateExclusive: '2026-11-27' },
    isCanceled: false,
  },
  {
    collectionKey: PERSONAL_COLLECTION_KEY,
    occurrenceKey: '3'.repeat(64),
    title: '취소된 약속',
    time: {
      kind: 'timed',
      startsAt: '2026-11-27T09:00:00.000Z',
      endsAt: '2026-11-27T10:00:00.000Z',
    },
    isCanceled: true,
  },
  {
    collectionKey: HOLIDAY_COLLECTION_KEY,
    occurrenceKey: '4'.repeat(64),
    title: '성탄절',
    time: { kind: 'allDay', startDate: '2026-12-25', endDateExclusive: '2026-12-26' },
    isCanceled: false,
  },
];

interface TodoImportSourceStubOptions {
  permission?: OsPermission;
  collections?: readonly ImportCollectionRecord[];
  events?: readonly ImportEventRecord[];
}

/** 아직 권한을 묻지 않은 기기에 개인·공휴일 캘린더가 있다. `readEvents`는 고른 캘린더의 일정만 준다 */
export function createTodoImportSourceStub({
  permission = { status: 'undetermined', canAskAgain: true },
  collections = DEFAULT_COLLECTIONS,
  events = DEFAULT_EVENTS,
}: TodoImportSourceStubOptions = {}): jest.Mocked<TodoImportSource> {
  return {
    getPermission: mockMethod<TodoImportSource['getPermission']>(async () => ({ ...permission })),
    requestPermission: mockMethod<TodoImportSource['requestPermission']>(async () => ({
      ...permission,
    })),
    listCollections: mockMethod<TodoImportSource['listCollections']>(async () =>
      collections.map((collection) => ({ ...collection })),
    ),
    readEvents: mockMethod<TodoImportSource['readEvents']>(async ({ collectionKeys }) =>
      events
        .filter((event) => collectionKeys.includes(event.collectionKey))
        .map((event) => ({ ...event })),
    ),
  };
}
