import { match, P } from 'ts-pattern';
import { z } from 'zod';

const IMPORT_ACCOUNT_KINDS = [
  'local',
  'cloud',
  'exchange',
  'subscribed',
  'birthdays',
  'holidays',
  'other',
] as const;

/** 기기 캘린더 하나와 고른 기간 안의 가져올 일정 수. 키는 기기가 원래 id를 해시한 값이다 */
export const importCollectionSchema = z.object({
  collectionKey: z.string(),
  title: z.string(),
  color: z.string().nullable(),
  accountName: z.string().nullable(),
  accountKind: z.enum(IMPORT_ACCOUNT_KINDS),
  itemCount: z.int().nonnegative(),
});
export type ImportCollection = z.infer<typeof importCollectionSchema>;

export type FilterImportCollection = (collection: ImportCollection) => boolean;
/** 계정 이름·캘린더 이름 순(기기 설정 앱과 같은 묶음 순서)이나 일정이 많은 순 */
export type OrderByImportCollection = 'account' | 'itemCount';

// 공휴일·생일·구독 캘린더는 내가 할 일이 아닌 일정이 수백 개씩 들어와 처음에는 고르지 않는다
function isSubscribedCalendar(collection: ImportCollection) {
  return match(collection.accountKind)
    .with(P.union('subscribed', 'birthdays', 'holidays'), () => true)
    .with(P.union('local', 'cloud', 'exchange', 'other'), () => false)
    .exhaustive();
}

/** 고른 기간에 가져올 일정이 없는 캘린더는 골라도 만들 할 일이 없다 */
function isSelectable(collection: ImportCollection) {
  return collection.itemCount > 0;
}

function isDefaultSelected(collection: ImportCollection) {
  return isSelectable(collection) && !isSubscribedCalendar(collection);
}

/**
 * 고른 캘린더 키. 아직 고르지 않았으면(null) 기본 선택이고, 고른 뒤 일정이 사라진 캘린더(기간을 줄임)는 뺀다.
 * 순서는 캘린더 목록 순서다
 */
function getSelectedCollections(
  collections: readonly ImportCollection[],
  selectedKeys: readonly string[] | null,
): ImportCollection[] {
  if (selectedKeys == null) {
    return collections.filter(isDefaultSelected);
  }
  const selected = new Set(selectedKeys);
  return collections.filter(
    (collection) => isSelectable(collection) && selected.has(collection.collectionKey),
  );
}

export const TodoImportCollectionPolicy = {
  isSubscribedCalendar,
  isSelectable,
  isDefaultSelected,
  getSelectedCollections,
} as const;
