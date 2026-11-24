import type { OsPermission } from '@src/core/ports/os-permission';
import type { DateKey } from '@src/shared/date/date-key';
import { groupBy, partition, sortBy } from 'es-toolkit';

import {
  IMPORT_RANGE_PRESET_NAMES,
  IMPORT_RANGE_PRESETS,
  type ImportRangePreset,
} from '../constants/todo-import.constants';
import {
  type ImportCollection,
  orderByAccountProvider,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { getRangeEndDate } from '../domains/todo-import.model';

export const IMPORT_RANGE_PRESET_LABEL_KEYS = {
  week: 'range.presets.week',
  month: 'range.presets.month',
  quarter: 'range.presets.quarter',
  half: 'range.presets.half',
  year: 'range.presets.year',
} as const satisfies Record<ImportRangePreset, string>;

/** 직접 고른 끝 날은 null이다 */
export function findRangePreset({
  startDate,
  endDate,
}: {
  startDate: DateKey;
  endDate: DateKey;
}): ImportRangePreset | null {
  return (
    IMPORT_RANGE_PRESET_NAMES.find(
      (preset) => getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]) === endDate,
    ) ?? null
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/** Android는 계정 이름이 이메일이라 같은 서비스의 계정 여러 개를 가려 보인다 */
export function findAccountEmail(collection: Pick<ImportCollection, 'accountName'>): string | null {
  const name = collection.accountName?.trim() ?? '';
  return EMAIL_PATTERN.test(name) ? name : null;
}

/** ask: 안내 뒤 묻는다, denied: 방금 거절해 글만 보인다, blocked: 다시 물을 수 없어 설정 열기를 보인다 */
export type CalendarPermissionView = 'ask' | 'denied' | 'blocked';

/** 방금 거절했으면 다시 조르지 않는다. 시스템이 다시 묻지 않는 상태면 설정 열기를 보인다 */
export function getCalendarPermissionView(
  permission: OsPermission,
  answered: OsPermission | null,
): CalendarPermissionView {
  if (permission.status === 'granted') {
    return 'ask';
  }
  const latest = answered ?? permission;
  if (latest.status === 'denied' && !latest.canAskAgain) {
    return 'blocked';
  }
  return answered == null ? 'ask' : 'denied';
}

/**
 * Android는 묻기 전에는 영구 거절을 알려 주지 않아 읽으면 늘 다시 물을 수 있다고 나온다.
 * 이번 실행에서 받은 "다시 묻지 않음" 답은 허용되기 전까지 남겨 다시 들어와도 설정 열기를 보인다
 */
export function keepBlockedCalendarPermission(
  previous: OsPermission | undefined,
  read: OsPermission,
): OsPermission {
  const isBlocked = previous?.status === 'denied' && !previous.canAskAgain;
  return isBlocked && read.status !== 'granted' ? previous : read;
}

export interface ImportAccountGroup {
  accountKey: string;
  /** 계정 이름·종류를 읽는 첫 캘린더 */
  account: ImportCollection;
  collections: ImportCollection[];
}

/**
 * 캘린더를 계정마다 묶는다. 공휴일·생일·구독처럼 받아 보기만 하는 캘린더는 계정과 상관없이
 * 맨 아래 한 묶음으로 따로 둔다. 내 계정이 먼저이고 묶음 안은 받은 순서다
 */
export function groupCollectionsByAccount(collections: readonly ImportCollection[]): {
  accounts: ImportAccountGroup[];
  receivedCollections: ImportCollection[];
} {
  const [receivedCollections, ownCollections] = partition(
    collections,
    TodoImportCollectionPolicy.isSubscribedCalendar,
  );
  const accounts = Object.entries(
    groupBy(ownCollections, (collection) => collection.accountName ?? ''),
  ).flatMap(([accountKey, group]) => {
    const [account] = group;
    return account == null ? [] : [{ accountKey, account, collections: group }];
  });

  return {
    accounts: sortBy(accounts, [({ account }) => orderByAccountProvider(account)]),
    receivedCollections,
  };
}

const NO_BREAK_SPACE = '\u00A0';
const WORD_JOINER = '\u2060';

/** 문장 안 날짜("12월 23일", "Dec 23")가 숫자와 글자 사이에서 다음 줄로 갈라지지 않게 잇는다 */
export function toUnbreakableLabel(label: string): string {
  return Array.from(label.replaceAll(' ', NO_BREAK_SPACE)).join(WORD_JOINER);
}
