import { hexColorRegex, TODO_CATEGORY_LIMITS } from '@aido/api/vocabulary';
import {
  type TodoCategory,
  TodoCategoryPolicy,
} from '@src/features/planning/category/domains/todo-category.model';
import { truncateGraphemes } from '@src/shared/domains/text-limit.model';
import { minBy, uniq } from 'es-toolkit';
import { z } from 'zod';

import {
  type TodoImportAccountProvider,
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from './todo-import-collection.model';

// 새 카테고리는 확정할 때 서버가 만든다
export const todoImportTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_CATEGORY'), name: z.string(), color: z.string() }),
  z.object({ kind: z.literal('EXISTING_CATEGORY'), categoryId: z.int() }),
]);
export type TodoImportTarget = z.infer<typeof todoImportTargetSchema>;
type NewCategoryTarget = Extract<TodoImportTarget, { kind: 'NEW_CATEGORY' }>;

// 새 카테고리 기본 이름에 쓰는 앱 언어 문구. 부르는 쪽이 정해 넘긴다
interface NewCategoryNaming {
  // 이름이 비었거나 계정 종류를 모를 때, 여러 캘린더를 모아 넣을 때
  fallbackName: string;
  // 캘린더 이름이 계정 이메일일 때 대신 쓰는 서비스 이름("Google"). null이면 fallbackName이다
  accountNames: Readonly<Record<TodoImportAccountProvider, string | null>>;
}

export interface NewCategoryDefaults {
  naming: NewCategoryNaming;
  // 첫 색이 기본 색이라 비어 있을 수 없다
  palette: readonly [string, ...string[]];
}

// limit: 남은 카테고리 자리가 없다, otherCalendars: 다른 캘린더가 고른 새 카테고리가 남은 자리를 다 잡았다
export type NewCategoryAvailability =
  | { kind: 'unlimited' }
  | { kind: 'available'; remainingCount: number }
  | { kind: 'locked'; reason: 'limit' | 'otherCalendars' };

type Rgb = readonly [red: number, green: number, blue: number];

const BYTE_BITS = 8;
const BYTE_MASK = 0xff;

function toComparableName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function parseRgb(color: string): Rgb | null {
  if (!hexColorRegex.test(color)) {
    return null;
  }
  const rgb = Number(`0x${color.slice(1)}`);
  return [(rgb >> (2 * BYTE_BITS)) & BYTE_MASK, (rgb >> BYTE_BITS) & BYTE_MASK, rgb & BYTE_MASK];
}

function calculateColorDistance(
  [red, green, blue]: Rgb,
  [otherRed, otherGreen, otherBlue]: Rgb,
): number {
  return (red - otherRed) ** 2 + (green - otherGreen) ** 2 + (blue - otherBlue) ** 2;
}

// 읽을 수 없는 색이면 팔레트 첫 색이다
export function getNearestPaletteColor(
  color: string | null,
  palette: NewCategoryDefaults['palette'],
): string {
  const [firstColor] = palette;
  const source = color == null ? null : parseRgb(color);
  if (source == null) {
    return firstColor;
  }

  return (
    minBy(palette, (paletteColor) => {
      const rgb = parseRgb(paletteColor);
      return rgb == null ? Number.POSITIVE_INFINITY : calculateColorDistance(source, rgb);
    }) ?? firstColor
  );
}

// 캘린더 이름이 계정 이메일이면 서버로 보내지 않고 서비스 이름을 쓴다. 서버 한도(UTF-16) 안에서 글자를 반으로 자르지 않는다
function getNewCategoryName(collection: TodoImportCollection, naming: NewCategoryNaming): string {
  const title = TodoImportCollectionPolicy.hasEmailTitle(collection)
    ? (naming.accountNames[collection.accountProvider] ?? naming.fallbackName)
    : collection.title;
  const name = truncateGraphemes(title.trim(), TODO_CATEGORY_LIMITS.NAME_MAX_LENGTH).trim();
  return name === '' ? naming.fallbackName : name;
}

// 캘린더 하나의 새 카테고리는 그 캘린더 이름과 가까운 색이다. 캘린더를 모아 넣으면(null) 기본 이름과 팔레트 첫 색이다
export function createNewCategoryTarget(
  collection: TodoImportCollection | null,
  { naming, palette }: NewCategoryDefaults,
): NewCategoryTarget {
  return {
    kind: 'NEW_CATEGORY',
    name: collection == null ? naming.fallbackName : getNewCategoryName(collection, naming),
    color: getNearestPaletteColor(collection?.color ?? null, palette),
  };
}

// 만드는 중인 카테고리는 아직 id가 없어 고르지 않고, 카테고리가 하나도 없을 때만 새 카테고리다
export function createDefaultTarget(
  categories: readonly TodoCategory[],
  newCategoryDefaults: NewCategoryDefaults,
): TodoImportTarget {
  const categoryId = TodoCategoryPolicy.findInitialCategoryId(
    categories.filter((category) => !TodoCategoryPolicy.isOptimisticCategory(category)),
    null,
  );
  return categoryId == null
    ? createNewCategoryTarget(null, newCategoryDefaults)
    : { kind: 'EXISTING_CATEGORY', categoryId };
}

export const TodoImportTargetPolicy = {
  isSameTarget(target: TodoImportTarget, other: TodoImportTarget): boolean {
    if (target.kind === 'NEW_CATEGORY' && other.kind === 'NEW_CATEGORY') {
      return toComparableName(target.name) === toComparableName(other.name);
    }
    if (target.kind === 'EXISTING_CATEGORY' && other.kind === 'EXISTING_CATEGORY') {
      return target.categoryId === other.categoryId;
    }
    return false;
  },

  // 이름이 같은 카테고리(공백·대소문자 무시)가 있으면 새로 만들지 않고 그 카테고리에 넣는다
  findSameNameCategory<TCategory extends TodoCategory>(
    target: TodoImportTarget,
    categories: readonly TCategory[],
  ): TCategory | null {
    if (target.kind !== 'NEW_CATEGORY') {
      return null;
    }
    const name = toComparableName(target.name);
    return (
      categories.find(
        (category) =>
          !TodoCategoryPolicy.isOptimisticCategory(category) &&
          toComparableName(category.name) === name,
      ) ?? null
    );
  },

  // 고른 카테고리가 목록에서 사라졌다(가져오기 전에 삭제했다). 새 카테고리는 아직 없어 사라질 수 없다
  isMissingCategory(target: TodoImportTarget, categories: readonly TodoCategory[]): boolean {
    return (
      target.kind === 'EXISTING_CATEGORY' &&
      TodoCategoryPolicy.findCategory(categories, target.categoryId) == null
    );
  },

  // 서버에 한도를 물을 카테고리. 새 카테고리는 아직 없어 null이고 서버가 빈 카테고리로 센다
  findLimitCategoryId(target: TodoImportTarget): number | null {
    return target.kind === 'EXISTING_CATEGORY' ? target.categoryId : null;
  },

  // 새로 만들 카테고리 수. 이름이 같은 새 카테고리는 서버가 하나로 만들어 한 번만 센다
  calculateNewCategoryCount(targets: readonly TodoImportTarget[]): number {
    const names = targets.flatMap((target) =>
      target.kind === 'NEW_CATEGORY' ? [toComparableName(target.name)] : [],
    );
    return uniq(names).length;
  },

  // 남은 자리(서버 값, null은 무제한)를 다른 캘린더가 고른 새 카테고리가 먼저 쓰고, 이름이 같으면 한 자리를 함께 쓴다
  getNewCategoryAvailability(
    newCategory: TodoImportTarget,
    otherTargets: readonly TodoImportTarget[],
    remainingCategoryCount: number | null,
  ): NewCategoryAvailability {
    if (remainingCategoryCount == null) {
      return { kind: 'unlimited' };
    }
    const otherNewCategoryCount = this.calculateNewCategoryCount(
      otherTargets.filter((target) => !this.isSameTarget(target, newCategory)),
    );
    const remainingCount = remainingCategoryCount - otherNewCategoryCount;
    if (0 < remainingCount) {
      return { kind: 'available', remainingCount };
    }
    return { kind: 'locked', reason: remainingCategoryCount <= 0 ? 'limit' : 'otherCalendars' };
  },
};
