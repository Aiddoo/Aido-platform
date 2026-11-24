import { createTodoCategorySchema } from '@aido/api/contracts/todo-category/v1';
import { minBy } from 'es-toolkit';

import {
  type ImportAccountProvider,
  type ImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { truncateGraphemes } from '../domains/todo-import-item.model';
import type { ImportTarget } from '../domains/todo-import-target.model';
import type { TodoImportCategoryMode } from '../schemas/todo-import-form.schema';

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/iu;
const HEX_RADIX = 16;
const CATEGORY_NAME_MAX_LENGTH = createTodoCategorySchema.shape.name.maxLength ?? 0;

/** 새 카테고리 기본 이름에 쓰는 앱 언어 문구. 부르는 화면이 정해 넘긴다 */
export interface NewCategoryNames {
  /** 이름이 비었거나 계정 종류를 모를 때, 여러 캘린더를 모아 넣을 때 */
  fallbackName: string;
  /** 캘린더 이름이 계정 이메일일 때 대신 쓰는 서비스 이름("Google"). null이면 fallbackName */
  accountNames: Readonly<Record<ImportAccountProvider, string | null>>;
}

function toRgb(color: string): [number, number, number] | null {
  const channels = HEX_COLOR_PATTERN.exec(color);
  if (channels == null) {
    return null;
  }
  return [
    Number.parseInt(channels[1] ?? '0', HEX_RADIX),
    Number.parseInt(channels[2] ?? '0', HEX_RADIX),
    Number.parseInt(channels[3] ?? '0', HEX_RADIX),
  ];
}

/** 읽을 수 없는 색이면 팔레트 첫 색이다 */
export function findNearestPaletteColor(color: string | null, palette: readonly string[]): string {
  const fallback = palette[0] ?? '';
  const source = color == null ? null : toRgb(color);
  if (source == null) {
    return fallback;
  }
  const [red, green, blue] = source;
  return (
    minBy(palette, (paletteColor) => {
      const [paletteRed = 0, paletteGreen = 0, paletteBlue = 0] = toRgb(paletteColor) ?? [];
      return (red - paletteRed) ** 2 + (green - paletteGreen) ** 2 + (blue - paletteBlue) ** 2;
    }) ?? fallback
  );
}

/**
 * 새 카테고리로 보낼 이름. 캘린더 이름이 계정 이메일이면 서버로 보내지 않고 계정 종류 이름을 쓴다.
 * 서버 한도(UTF-16 50자) 안에서 글자를 반으로 자르지 않는다
 */
export function toNewCategoryName(collection: ImportCollection, names: NewCategoryNames): string {
  const title = TodoImportCollectionPolicy.hasEmailTitle(collection)
    ? (names.accountNames[collection.accountProvider] ?? names.fallbackName)
    : collection.title;
  const name = truncateGraphemes(title.trim(), CATEGORY_NAME_MAX_LENGTH).trim();
  return name === '' ? names.fallbackName : name;
}

/** 캘린더 하나의 새 카테고리는 그 캘린더 이름과 가까운 색이다. 캘린더를 모아 넣으면(null) 기본 이름과 팔레트 첫 색이다 */
export function toNewCategoryTarget(
  collection: ImportCollection | null,
  { palette, names }: { palette: readonly string[]; names: NewCategoryNames },
): Extract<ImportTarget, { kind: 'NEW_CATEGORY' }> {
  return {
    kind: 'NEW_CATEGORY',
    name: collection == null ? names.fallbackName : toNewCategoryName(collection, names),
    color: findNearestPaletteColor(collection?.color ?? null, palette),
  };
}

/** 캘린더가 하나뿐이면 나눌 것이 없어 한 곳에 넣는 것과 같다 */
export function resolveCategoryMode(
  collections: readonly ImportCollection[],
  categoryMode: TodoImportCategoryMode,
): TodoImportCategoryMode {
  return collections.length < 2 ? 'single' : categoryMode;
}

interface ImportTargetChoice {
  categoryMode: TodoImportCategoryMode;
  /** 모두 넣을 곳. null은 아직 고르지 않아 `fallbackTarget`이다 */
  singleTarget: ImportTarget | null;
  /** 캘린더마다 고른 곳. 고르지 않은 캘린더는 모두 넣을 곳이다 */
  targets: Readonly<Record<string, ImportTarget>>;
}

/**
 * 캘린더마다 넣을 곳. 한 곳에 넣으면 모두 그곳이고, 캘린더마다 넣어도 고르지 않은 캘린더는 그곳이다.
 * 캘린더마다 고른 값은 한 곳에 넣는 동안에도 남아 다시 나누면 돌아온다. 넣을 곳이 없으면 그 캘린더를 뺀다
 */
export function resolveImportTargets(
  collections: readonly ImportCollection[],
  { categoryMode, singleTarget, targets }: ImportTargetChoice,
  fallbackTarget: ImportTarget | null,
): Record<string, ImportTarget> {
  const destination = singleTarget ?? fallbackTarget;
  const isSeparate = resolveCategoryMode(collections, categoryMode) === 'separate';

  return Object.fromEntries(
    collections.flatMap((collection) => {
      const target = (isSeparate ? targets[collection.collectionKey] : null) ?? destination;
      return target == null ? [] : [[collection.collectionKey, target]];
    }),
  );
}
