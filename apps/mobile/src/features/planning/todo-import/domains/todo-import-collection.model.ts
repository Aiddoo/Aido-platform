import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { orderBy, sumBy, take } from 'es-toolkit';
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

// 내 계정 캘린더를 먼저 고르고, 받아 보기만 하는 구독·생일 캘린더는 뒤에서 고른다
export function orderByAccountProvider(collection: ImportCollection): number {
  return match(collection.accountProvider)
    .with(P.union('icloud', 'google', 'outlook', 'device', 'other'), () => 0)
    .with(P.union('subscribed', 'birthdays'), () => 1)
    .exhaustive();
}

// 이름 안 어디에든 이메일이 있으면 이메일 모양으로 본다("me@gmail.com", "업무 (me@company.com)")
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/u;

export const TodoImportCollectionPolicy = {
  // 공휴일·생일·구독 캘린더는 내가 할 일이 아닌 일정이 수백 개씩 들어와 처음에는 고르지 않는다
  isSubscribedCalendar(collection: ImportCollection): boolean {
    return match(collection.accountKind)
      .with(P.union('subscribed', 'birthdays', 'holidays'), () => true)
      .with(P.union('local', 'cloud', 'exchange', 'other'), () => false)
      .exhaustive();
  },

  isSelectable(collection: ImportCollection): boolean {
    return collection.itemCount > 0;
  },

  isDefaultSelected(collection: ImportCollection): boolean {
    return this.isSelectable(collection) && !this.isSubscribedCalendar(collection);
  },

  /**
   * null은 기본 선택이다. 고른 뒤 기간을 줄여 일정이 사라진 캘린더는 뺀다.
   * 서버는 한 번에 캘린더 `MAX_COLLECTIONS`개까지 받아, 기본 선택은 일정이 많은 캘린더부터 그만큼만 고르고
   * 고른 값도 그 수를 넘기지 않는다. 결과는 받은 목록 순서다
   */
  getSelectedCollections(
    collections: readonly ImportCollection[],
    selectedKeys: readonly string[] | null,
  ): ImportCollection[] {
    const candidates =
      selectedKeys == null
        ? orderBy(
            collections.filter((collection) => this.isDefaultSelected(collection)),
            [(collection) => collection.itemCount],
            ['desc'],
          )
        : collections.filter(
            (collection) =>
              this.isSelectable(collection) && selectedKeys.includes(collection.collectionKey),
          );
    const selected = new Set(
      take(candidates, TODO_IMPORT_LIMITS.MAX_COLLECTIONS).map(
        (collection) => collection.collectionKey,
      ),
    );
    return collections.filter((collection) => selected.has(collection.collectionKey));
  },

  /** Google·Outlook·iCloud는 기본 캘린더 이름이 계정 이메일이다. 이 이름은 아이두로 보내지 않는다 */
  hasEmailTitle(collection: ImportCollection): boolean {
    return EMAIL_PATTERN.test(collection.title);
  },

  /** 더 고를 수 없으면 고르지 않은 캘린더를 막는다 */
  isAtCollectionLimit(selected: readonly ImportCollection[]): boolean {
    return TODO_IMPORT_LIMITS.MAX_COLLECTIONS <= selected.length;
  },

  calculateItemCount(collections: readonly ImportCollection[]): number {
    return sumBy(collections, (collection) => collection.itemCount);
  },

  /** 서버가 한 번에 받는 일정 수(`MAX_ITEMS_PER_IMPORT`)를 넘으면 시작하지 못한다 */
  isOverImportLimit(collections: readonly ImportCollection[]): boolean {
    return TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT < this.calculateItemCount(collections);
  },
};
