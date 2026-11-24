import { createTodoCategorySchema } from '@aido/api/contracts/todo-category/v1';
import type { TodoCategory } from '@src/features/planning/category/domains/todo-category.model';
import { minBy, pick } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import {
  type ImportTarget,
  type ImportTargetSuggestion,
  TodoImportTargetPolicy,
} from '../domains/todo-import-target.model';

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/iu;
const HEX_RADIX = 16;
const CATEGORY_NAME_MAX_LENGTH = createTodoCategorySchema.shape.name.maxLength ?? 0;

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

function toCategoryName(title: string, fallbackName: string) {
  const name = Array.from(title.trim()).slice(0, CATEGORY_NAME_MAX_LENGTH).join('').trim();
  return name === '' ? fallbackName : name;
}

export function toNewCategoryTarget(
  collection: ImportCollection,
  { palette, fallbackName }: { palette: readonly string[]; fallbackName: string },
): Extract<ImportTarget, { kind: 'NEW_CATEGORY' }> {
  return {
    kind: 'NEW_CATEGORY',
    name: toCategoryName(collection.title, fallbackName),
    color: findNearestPaletteColor(collection.color, palette),
  };
}

function toImportTargets(
  collections: readonly ImportCollection[],
  suggestions: Readonly<Record<string, ImportTargetSuggestion>>,
  { palette, fallbackName }: { palette: readonly string[]; fallbackName: string },
): Record<string, ImportTarget> {
  return Object.fromEntries(
    collections.map((collection): [string, ImportTarget] => [
      collection.collectionKey,
      match(suggestions[collection.collectionKey] ?? { kind: 'NEW_CATEGORY' as const })
        .returnType<ImportTarget>()
        .with({ kind: 'NEW_CATEGORY' }, () =>
          toNewCategoryTarget(collection, { palette, fallbackName }),
        )
        .with({ kind: 'EXISTING_CATEGORY' }, ({ categoryId }) => ({
          kind: 'EXISTING_CATEGORY',
          categoryId,
        }))
        .exhaustive(),
    ]),
  );
}

interface ResolveImportTargetsContext {
  categories: readonly TodoCategory[];
  /** null은 제한이 없다 */
  remainingCategorySlots: number | null;
  palette: readonly string[];
  fallbackName: string;
}

export function resolveImportTargets(
  collections: readonly ImportCollection[],
  chosen: Readonly<Record<string, ImportTarget>>,
  { categories, remainingCategorySlots, palette, fallbackName }: ResolveImportTargetsContext,
): Record<string, ImportTarget> {
  const suggestions = TodoImportTargetPolicy.suggestTargets(collections, {
    categories,
    remainingCategorySlots,
  });
  return {
    ...toImportTargets(collections, suggestions, { palette, fallbackName }),
    ...pick(
      chosen,
      collections.map((collection) => collection.collectionKey),
    ),
  };
}
