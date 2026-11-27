import type { OsPermission } from '@src/core/ports/os-permission';
import type { TodoCategory } from '@src/features/planning/category/domains/todo-category.model';
import type { DateKey } from '@src/shared/date/date-key';
import {
  type DateFormatContext,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';
import { formatRangeLabel } from '@src/shared/date/format/date-labels';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import { countBy, groupBy } from 'es-toolkit';

import {
  type TodoImportAccountProvider,
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import type { TodoImportRange, TodoImportRangePreset } from '../domains/todo-import-range.model';
import type { TodoImportTarget } from '../domains/todo-import-target.model';

const RANGE_PRESET_LABEL_KEYS = {
  week: 'range.presets.week',
  month: 'range.presets.month',
  quarter: 'range.presets.quarter',
  half: 'range.presets.half',
  year: 'range.presets.year',
} as const satisfies Record<TodoImportRangePreset, string>;

export function getRangePresetLabelKey(preset: TodoImportRangePreset) {
  return RANGE_PRESET_LABEL_KEYS[preset];
}

/** ask: 안내 뒤 묻는다, denied: 방금 거절해 설정 열기를 보인다, blocked: 시스템이 다시 묻지 않아 늘 설정 열기다 */
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

// Apple·Google·Microsoft 로고·색은 서면 허락 없이 쓸 수 없어 다른 서비스는 이름 글자로만 알린다
const CALENDAR_SOURCE_LABEL_KEYS = {
  icloud: 'sources.icloud',
  google: 'sources.google',
  outlook: 'sources.outlook',
  device: 'sources.device',
  subscribed: 'sources.subscribed',
  birthdays: 'sources.birthdays',
  other: 'sources.other',
} as const satisfies Record<TodoImportAccountProvider, string>;

export function getCalendarSourceLabelKey(provider: TodoImportAccountProvider) {
  return CALENDAR_SOURCE_LABEL_KEYS[provider];
}

export interface TodoImportSourceGroup {
  sourceKey: string;
  provider: TodoImportAccountProvider;
  // 같은 서비스의 계정이 둘 이상일 때 가려 보일 계정 이메일·이름. 하나뿐이면 null이다
  accountLabel: string | null;
  collections: TodoImportCollection[];
  // 캘린더 이름을 " · "로 이은 한 줄
  calendarNames: string;
  itemCount: number;
}

const CALENDAR_NAME_SEPARATOR = ' · ';
const MIN_AMBIGUOUS_ACCOUNT_COUNT = 2;

// 공휴일·생일·구독 캘린더는 계정과 상관없이 종류 하나로 묶는다
function toSourceKey(collection: TodoImportCollection) {
  return TodoImportCollectionPolicy.isReceivedCalendar(collection)
    ? collection.accountProvider
    : `${collection.accountProvider}:${TodoImportCollectionPolicy.getAccountKey(collection)}`;
}

// 같은 서비스 계정이 둘 이상이면(Google 계정 두 개) 계정 이메일·이름을 붙여 가린다
export function groupCollectionsBySource(
  collections: readonly TodoImportCollection[],
): TodoImportSourceGroup[] {
  const groups = Object.entries(groupBy(collections, toSourceKey)).flatMap(([sourceKey, group]) => {
    const [account] = group;
    return account == null ? [] : [{ sourceKey, account, collections: group }];
  });
  const groupCountByProvider = countBy(groups, ({ account }) => account.accountProvider);
  const isAmbiguous = (provider: TodoImportAccountProvider) => {
    const groupCount = groupCountByProvider[provider];
    return groupCount != null && MIN_AMBIGUOUS_ACCOUNT_COUNT <= groupCount;
  };

  return groups.map(({ sourceKey, account, collections: group }) => ({
    sourceKey,
    provider: account.accountProvider,
    accountLabel: isAmbiguous(account.accountProvider)
      ? TodoImportCollectionPolicy.findAccountName(account)
      : null,
    collections: group,
    calendarNames: group.map(({ title }) => title).join(CALENDAR_NAME_SEPARATOR),
    itemCount: TodoImportCollectionPolicy.calculateItemCount(group),
  }));
}

export interface TodoImportTargetAppearance {
  name: string;
  color: string;
  // 가져오기를 확정할 때 새로 만든다
  isNew: boolean;
}

// 넣을 곳의 이름·색. 고른 카테고리가 목록에서 사라졌으면(삭제) null이다
export function findTargetAppearance(
  target: TodoImportTarget,
  categories: readonly TodoCategory[],
): TodoImportTargetAppearance | null {
  if (target.kind === 'NEW_CATEGORY') {
    return { name: target.name, color: target.color, isNew: true };
  }
  const category = categories.find(({ id }) => id === target.categoryId);
  return category == null ? null : { name: category.name, color: category.color, isNew: false };
}

const NO_BREAK_SPACE = '\u00A0';
const WORD_JOINER = '\u2060';

/** 문장 안 날짜("12월 23일", "Dec 23")가 숫자와 글자 사이에서 다음 줄로 갈라지지 않게 잇는다 */
export function formatUnbreakableLabel(label: string): string {
  return Array.from(label.replaceAll(' ', NO_BREAK_SPACE)).join(WORD_JOINER);
}

export interface ImportRangeLabels {
  start: string;
  // 하루만 가져오면 null이다
  end: string | null;
}

// 가져올 기간의 첫날·끝 날 글자. 기간 입력 칸과 같은 포맷이라 날마다 올해가 아니면 해를 붙인다
export function getImportRangeLabels(
  range: TodoImportRange,
  todayKey: DateKey,
  context: DateFormatContext,
): ImportRangeLabels {
  return {
    start: formatYearAwareDateKeyLabel(range.startDate, todayKey, context),
    end:
      range.endDate === range.startDate
        ? null
        : formatYearAwareDateKeyLabel(range.endDate, todayKey, context),
  };
}

// 가져올 기간 한 줄("11월 26일~2027년 1월 5일"). 하루면 그날 하나다
export function formatImportRange(
  range: TodoImportRange,
  todayKey: DateKey,
  context: DateFormatContext,
): string {
  const { start, end } = getImportRangeLabels(range, todayKey, context);
  return end == null ? start : formatRangeLabel({ start, end }, 'compact', context);
}
