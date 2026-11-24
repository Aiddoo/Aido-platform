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

const IMPORT_ACCOUNT_PROVIDERS = [
  'icloud',
  'google',
  'outlook',
  'device',
  'subscribed',
  'birthdays',
  'other',
] as const;

export type ImportAccountProvider = (typeof IMPORT_ACCOUNT_PROVIDERS)[number];

/** 키는 기기가 원래 id를 해시한 값이다 */
export const importCollectionSchema = z.object({
  collectionKey: z.string(),
  title: z.string(),
  color: z.string().nullable(),
  accountName: z.string().nullable(),
  accountKind: z.enum(IMPORT_ACCOUNT_KINDS),
  accountProvider: z.enum(IMPORT_ACCOUNT_PROVIDERS),
  itemCount: z.int().nonnegative(),
});
export type ImportCollection = z.infer<typeof importCollectionSchema>;

export type FilterImportCollection = (collection: ImportCollection) => boolean;
/** account는 기기 설정 앱과 같은 계정·이름 순이다 */
export type OrderByImportCollection = 'account' | 'itemCount';

// 내 계정 캘린더를 먼저 고르고, 받아 보기만 하는 구독·생일 캘린더는 뒤에서 고른다
export function orderByAccountProvider(collection: ImportCollection): number {
  return match(collection.accountProvider)
    .with(P.union('icloud', 'google', 'outlook', 'device', 'other'), () => 0)
    .with(P.union('subscribed', 'birthdays'), () => 1)
    .exhaustive();
}

// 공휴일·생일·구독 캘린더는 내가 할 일이 아닌 일정이 수백 개씩 들어와 처음에는 고르지 않는다
function isSubscribedCalendar(collection: ImportCollection) {
  return match(collection.accountKind)
    .with(P.union('subscribed', 'birthdays', 'holidays'), () => true)
    .with(P.union('local', 'cloud', 'exchange', 'other'), () => false)
    .exhaustive();
}

function isSelectable(collection: ImportCollection) {
  return collection.itemCount > 0;
}

function isDefaultSelected(collection: ImportCollection) {
  return isSelectable(collection) && !isSubscribedCalendar(collection);
}

/** null은 기본 선택이다. 고른 뒤 기간을 줄여 일정이 사라진 캘린더는 뺀다 */
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
