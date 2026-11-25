import type { ImportCollectionRecord } from '@src/core/ports/todo-import-source';

import type { TodoImportAccountProvider } from '../domains/todo-import-collection.model';
import { toAccountProvider } from './todo-import-collection.mapper';

describe('toAccountProvider', () => {
  it.each<
    [string, string | null, ImportCollectionRecord['accountKind'], TodoImportAccountProvider]
  >([
    ['iOS Google 계정은 기본 설명이 Gmail이다', 'Gmail', 'cloud', 'google'],
    ['Android Google 계정은 이메일이다', 'me@gmail.com', 'holidays', 'google'],
    ['iCloud', 'iCloud', 'cloud', 'icloud'],
    ['iOS 구독 캘린더 묶음', 'Subscribed Calendars', 'subscribed', 'subscribed'],
    ['iOS 생일이 든 기타 묶음', 'Other', 'other', 'birthdays'],
    ['iOS 기기에만 저장한 캘린더', 'On My iPhone', 'local', 'device'],
    ['이름으로 모르는 Exchange 계정', 'work@company.com', 'exchange', 'outlook'],
    ['이름으로 모르는 Android 기기 캘린더', 'My calendar', 'local', 'device'],
    ['이름으로 모르는 CalDAV 계정', 'Naver', 'cloud', 'other'],
    ['계정 이름이 없는 공휴일', null, 'holidays', 'subscribed'],
  ])('%s', (_case, accountName, accountKind, expected) => {
    // When
    const provider = toAccountProvider({ accountName, accountKind });

    // Then
    expect(provider).toBe(expected);
  });
});
