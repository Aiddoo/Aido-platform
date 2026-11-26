import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { orderBy, sumBy, take } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

const TODO_IMPORT_ACCOUNT_KINDS = [
  'local',
  'cloud',
  'exchange',
  'subscribed',
  'birthdays',
  'holidays',
  'other',
] as const;

const TODO_IMPORT_ACCOUNT_PROVIDERS = [
  'icloud',
  'google',
  'outlook',
  'device',
  'subscribed',
  'birthdays',
  'other',
] as const;

export type TodoImportAccountProvider = (typeof TODO_IMPORT_ACCOUNT_PROVIDERS)[number];

// 키는 기기가 원래 id를 해시한 값이다
export const todoImportCollectionSchema = z.object({
  collectionKey: z.string(),
  title: z.string(),
  color: z.string().nullable(),
  accountName: z.string().nullable(),
  accountKind: z.enum(TODO_IMPORT_ACCOUNT_KINDS),
  accountProvider: z.enum(TODO_IMPORT_ACCOUNT_PROVIDERS),
  itemCount: z.int().nonnegative(),
});
export type TodoImportCollection = z.infer<typeof todoImportCollectionSchema>;

// 이름 안 어디에든 이메일이 있으면 이메일이 든 이름이다("me@gmail.com", "업무 (me@company.com)")
const CONTAINS_EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
// 이름 전체가 이메일 하나다. Android 계정 이름은 도메인에 점이 없는 것도 있다
const IS_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/u;

// 목록 정렬 키. 내 계정 캘린더를 먼저 두고, 받아 보기만 하는 구독·생일 계정은 뒤에 둔다
export function orderByAccountProvider(collection: TodoImportCollection): number {
  return match(collection.accountProvider)
    .with(P.union('icloud', 'google', 'outlook', 'device', 'other'), () => 0)
    .with(P.union('subscribed', 'birthdays'), () => 1)
    .exhaustive();
}

export const TodoImportCollectionPolicy = {
  // 공휴일·생일·구독 캘린더는 받아 보기만 하는 일정이 수백 개씩 들어와 처음에는 고르지 않는다
  isReceivedCalendar(collection: TodoImportCollection): boolean {
    return match(collection.accountKind)
      .with(P.union('subscribed', 'birthdays', 'holidays'), () => true)
      .with(P.union('local', 'cloud', 'exchange', 'other'), () => false)
      .exhaustive();
  },

  isSelectable(collection: TodoImportCollection): boolean {
    return 0 < collection.itemCount;
  },

  isDefaultSelected(collection: TodoImportCollection): boolean {
    return this.isSelectable(collection) && !this.isReceivedCalendar(collection);
  },

  // 같은 계정의 캘린더를 묶고 줄 세우는 키. 계정 이름이 없는 캘린더끼리 한 묶음이고 맨 앞이다
  getAccountKey(collection: TodoImportCollection): string {
    return collection.accountName ?? '';
  },

  // iOS 계정 이름은 기기 설정의 계정 설명("Gmail", "회사")이고 Android는 이메일이다. 비었으면 없는 것이다
  findAccountName(collection: TodoImportCollection): string | null {
    const name = collection.accountName?.trim();
    return name == null || name === '' ? null : name;
  },

  // Android는 계정 이름이 이메일이라 같은 서비스의 계정 여러 개를 가려 보인다
  findAccountEmail(collection: TodoImportCollection): string | null {
    const name = this.findAccountName(collection);
    return name != null && IS_EMAIL_PATTERN.test(name) ? name : null;
  },

  // Google·Outlook·iCloud는 기본 캘린더 이름이 계정 이메일이다. 이 이름은 아이두로 보내지 않는다
  hasEmailTitle(collection: TodoImportCollection): boolean {
    return CONTAINS_EMAIL_PATTERN.test(collection.title);
  },

  // null은 기본 선택이다. 서버는 한 번에 캘린더 MAX_COLLECTIONS개까지 받아 기본 선택·고른 값 모두 그 수를 넘기지 않는다
  getSelectedCollections(
    collections: readonly TodoImportCollection[],
    selectedKeys: readonly string[] | null,
  ): TodoImportCollection[] {
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

  // 더 고를 수 없으면 고르지 않은 캘린더를 막는다
  isAtCollectionLimit(selected: readonly TodoImportCollection[]): boolean {
    return TODO_IMPORT_LIMITS.MAX_COLLECTIONS <= selected.length;
  },

  calculateItemCount(collections: readonly TodoImportCollection[]): number {
    return sumBy(collections, (collection) => collection.itemCount);
  },

  // 서버가 한 번에 받는 일정 수(MAX_ITEMS_PER_IMPORT)를 넘으면 시작하지 못한다
  isOverImportLimit(collections: readonly TodoImportCollection[]): boolean {
    return TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT < this.calculateItemCount(collections);
  },
};
