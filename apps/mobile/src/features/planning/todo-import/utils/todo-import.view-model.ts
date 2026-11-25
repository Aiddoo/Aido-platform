import type { OsPermission } from '@src/core/ports/os-permission';
import type { TodoCategory } from '@src/features/planning/category/domains/todo-category.model';
import type { DateKey } from '@src/shared/date/date-key';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import { countBy, groupBy, partition, sortBy } from 'es-toolkit';

import {
  IMPORT_RANGE_PRESET_NAMES,
  IMPORT_RANGE_PRESETS,
  type ImportRangePreset,
} from '../constants/todo-import.constants';
import {
  type ImportAccountProvider,
  type ImportCollection,
  orderByAccountProvider,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import type { ImportTarget, TargetPlacement } from '../domains/todo-import-target.model';
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

/**
 * ask: 안내 뒤 묻는다, denied: 방금 거절해 다시 묻지 않고 설정 열기를 보인다,
 * blocked: 시스템이 다시 묻지 않아 다시 들어와도 설정 열기를 보인다
 */
export type CalendarPermissionView = 'ask' | 'denied' | 'blocked';

/** 방금 거절했으면 다시 조르지 않는다. 다시 물을 수 있으면 다음에 들어올 때 다시 안내한다 */
export function getCalendarPermissionView(
  permission: OsPermission,
  answered: OsPermission | null,
): CalendarPermissionView {
  if (getOsPermissionAccess(permission) === 'granted') {
    return 'ask';
  }
  if (getOsPermissionAccess(answered ?? permission) === 'settings') {
    return 'blocked';
  }
  return answered == null ? 'ask' : 'denied';
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
  const [receivedCollections, ownCollections] = partition(collections, (collection) =>
    TodoImportCollectionPolicy.isSubscribedCalendar(collection),
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

/**
 * 다른 서비스는 이름 글자로만 알린다. Apple·Google·Microsoft 로고·색은 서면 허락 없이 쓸 수 없어 그리지 않는다.
 * 계정 이메일 같은 캘린더 이름 대신 새 카테고리 이름으로도 쓴다
 */
export const CALENDAR_SOURCE_LABEL_KEYS = {
  icloud: 'sources.icloud',
  google: 'sources.google',
  outlook: 'sources.outlook',
  device: 'sources.device',
  subscribed: 'sources.subscribed',
  birthdays: 'sources.birthdays',
  other: 'sources.other',
} as const satisfies Record<ImportAccountProvider, string>;

export interface ImportSourceGroup {
  sourceKey: string;
  provider: ImportAccountProvider;
  /** 같은 서비스의 계정이 둘 이상일 때 가려 보일 계정 이메일·이름. 하나뿐이면 null이다 */
  accountLabel: string | null;
  collections: ImportCollection[];
  /** 캘린더 이름을 " · "로 이은 한 줄 */
  calendarNames: string;
  itemCount: number;
}

const CALENDAR_NAME_SEPARATOR = ' · ';

/** iOS 계정 이름은 기기 설정의 계정 설명("Gmail", "회사")이고 Android는 이메일이다 */
function findAccountLabel(collection: Pick<ImportCollection, 'accountName'>): string | null {
  const name = collection.accountName?.trim() ?? '';
  return name === '' ? null : name;
}

/** 공휴일·생일·구독 캘린더는 계정과 상관없이 종류 하나로 묶는다 */
function toSourceKey(collection: ImportCollection) {
  return TodoImportCollectionPolicy.isSubscribedCalendar(collection)
    ? collection.accountProvider
    : `${collection.accountProvider}:${collection.accountName ?? ''}`;
}

/**
 * 가져올 캘린더를 출처 계정마다 한 줄로 묶는다. 순서는 받은 순서다.
 * 같은 서비스 계정이 둘 이상이면(Google 계정 두 개) 계정 이메일·이름을 붙여 가린다
 */
export function groupCollectionsBySource(
  collections: readonly ImportCollection[],
): ImportSourceGroup[] {
  const groups = Object.entries(groupBy(collections, toSourceKey)).flatMap(([sourceKey, group]) => {
    const [account] = group;
    return account == null ? [] : [{ sourceKey, account, collections: group }];
  });
  const groupCountByProvider = countBy(groups, ({ account }) => account.accountProvider);

  return groups.map(({ sourceKey, account, collections: group }) => ({
    sourceKey,
    provider: account.accountProvider,
    accountLabel:
      (groupCountByProvider[account.accountProvider] ?? 0) < 2 ? null : findAccountLabel(account),
    collections: group,
    calendarNames: group.map(({ title }) => title).join(CALENDAR_NAME_SEPARATOR),
    itemCount: TodoImportCollectionPolicy.calculateItemCount(group),
  }));
}

export interface ImportTargetAppearance {
  name: string;
  color: string;
  /** 가져오기를 확정할 때 새로 만든다 */
  isNew: boolean;
}

/** 넣을 곳의 이름·색. 고른 카테고리가 목록에서 사라졌으면(삭제) null이다 */
export function findTargetAppearance(
  target: ImportTarget,
  categories: readonly TodoCategory[],
): ImportTargetAppearance | null {
  if (target.kind === 'NEW_CATEGORY') {
    return { name: target.name, color: target.color, isNew: true };
  }
  const category = categories.find(({ id }) => id === target.categoryId);
  return category == null ? null : { name: category.name, color: category.color, isNew: false };
}

/** 넣을 곳 아래 한 줄의 종류. 넘치거나(overflow) 가득 찬(full) 곳은 경고다 */
export type PlacementStatus = 'fits' | 'fillsUp' | 'overflow' | 'full';

export function getPlacementStatus(placement: TargetPlacement): PlacementStatus {
  if (placement.roomLeft === 0) {
    return 'full';
  }
  if (0 < placement.skippedCount) {
    return 'overflow';
  }
  return placement.remainingCount === 0 ? 'fillsUp' : 'fits';
}

const NO_BREAK_SPACE = '\u00A0';
const WORD_JOINER = '\u2060';

/** 문장 안 날짜("12월 23일", "Dec 23")가 숫자와 글자 사이에서 다음 줄로 갈라지지 않게 잇는다 */
export function toUnbreakableLabel(label: string): string {
  return Array.from(label.replaceAll(' ', NO_BREAK_SPACE)).join(WORD_JOINER);
}
