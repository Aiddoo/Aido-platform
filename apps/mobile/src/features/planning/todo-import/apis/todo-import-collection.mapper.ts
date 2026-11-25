import type { ImportCollectionRecord } from '@src/core/ports/todo-import-source';
import { match, P } from 'ts-pattern';

import type {
  TodoImportAccountProvider,
  TodoImportCollection,
} from '../domains/todo-import-collection.model';

export function toTodoImportCollection(
  record: ImportCollectionRecord,
  itemCountByCollection: Readonly<Record<string, number>>,
): TodoImportCollection {
  return {
    ...record,
    accountProvider: toAccountProvider(record),
    // 고른 기간에 일정이 없는 캘린더는 센 값이 없다
    itemCount: itemCountByCollection[record.collectionKey] ?? 0,
  };
}

// iOS는 계정 이름으로 기기 설정의 계정 설명(Google은 기본 "Gmail")이나 영어 시스템 이름("Other" 등)을 준다
function findProviderByAccountName(accountName: string): TodoImportAccountProvider | null {
  const name = accountName.trim().toLowerCase();

  if (name === 'icloud') {
    return 'icloud';
  }
  if (/gmail|google/.test(name)) {
    return 'google';
  }
  if (/outlook|hotmail|live\.com|exchange/.test(name)) {
    return 'outlook';
  }
  if (name === 'subscribed calendars') {
    return 'subscribed';
  }
  if (name === 'other') {
    return 'birthdays';
  }
  if (/^on my (iphone|ipad|mac)$/.test(name)) {
    return 'device';
  }
  return null;
}

// 이름으로 모르면 캘린더 종류로 가린다
export function toAccountProvider({
  accountName,
  accountKind,
}: Pick<ImportCollectionRecord, 'accountName' | 'accountKind'>): TodoImportAccountProvider {
  const namedProvider = accountName == null ? null : findProviderByAccountName(accountName);

  return (
    namedProvider ??
    match(accountKind)
      .returnType<TodoImportAccountProvider>()
      .with('local', () => 'device')
      .with('exchange', () => 'outlook')
      .with(P.union('subscribed', 'holidays'), () => 'subscribed')
      .with('birthdays', () => 'birthdays')
      .with(P.union('cloud', 'other'), () => 'other')
      .exhaustive()
  );
}
