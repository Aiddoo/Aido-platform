import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import {
  type TodoCategoryWithCount,
  TodoCategoryPolicy,
} from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  SettingsListGroup,
  useOpenKeyboardSheet,
  useOpenSheet,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { compact, pick, range } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import {
  applyCategoryMode,
  resolveCategoryMode,
  resolveImportTargets,
  toNewCategoryTarget,
} from '../apis/todo-import-target.mapper';
import type { ImportCollection } from '../domains/todo-import-collection.model';
import { type ImportTarget, TodoImportTargetPolicy } from '../domains/todo-import-target.model';
import { useNewCategoryNames } from '../hooks/use-new-category-names';
import type { TodoImportCategoryMode } from '../schemas/todo-import-form.schema';
import { type CategoryTargetChoice, CategoryTargetSheet } from './category-target-sheet';

interface CategoryMappingListProps {
  collections: readonly ImportCollection[];
  categoryMode: TodoImportCategoryMode;
  /** 캘린더마다 고른 곳. 없는 캘린더는 기본 연결 규칙을 보인다 */
  value: Readonly<Record<string, ImportTarget>>;
  onValueChange: (targets: Record<string, ImportTarget>) => void;
  /** 한 카테고리에 모을 곳. null이면 첫 캘린더의 곳을 보인다 */
  singleTarget: ImportTarget | null;
  onSingleTargetChange: (target: ImportTarget) => void;
  errorMessages?: Readonly<Record<string, string>>;
}

const DEFAULT_LOADING_ROW_COUNT = 3;

/**
 * 캘린더마다 넣을 카테고리, 또는 모두 모을 카테고리 하나를 설정 행으로 보인다. 행을 누르면 고르는 시트를 열고,
 * 아래에 새 카테고리를 몇 개 더 만들 수 있는지 알린다
 */
export function CategoryMappingList({
  collections,
  categoryMode,
  value,
  onValueChange,
  singleTarget,
  onSingleTargetChange,
  errorMessages,
}: CategoryMappingListProps) {
  const { t } = useTranslation('todoImport');
  const openSheet = useOpenSheet();
  const openKeyboardSheet = useOpenKeyboardSheet();
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'todo_import' });
  const [{ data: categoriesResult }, { data: snapshot }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetEntitlementsQueryOptions()],
  });

  const { categories } = categoriesResult;
  const remainingCategorySlots = EntitlementPolicy.findRemainingCount(snapshot, 'TODO_CATEGORY');
  const freeCategoryLimit = EntitlementPolicy.hasFullAccess(snapshot)
    ? null
    : EntitlementPolicy.findLimit(snapshot, 'TODO_CATEGORY');
  const names = useNewCategoryNames();
  const targets = resolveImportTargets(collections, value, {
    categories,
    remainingCategorySlots,
    palette: CATEGORY_COLORS,
    names,
  });
  const mode = resolveCategoryMode(collections, categoryMode);
  const appliedTargets = applyCategoryMode(collections, targets, { categoryMode, singleTarget });
  const newCategoryCount = TodoImportTargetPolicy.countNewCategories(Object.values(appliedTargets));

  const chooseTarget = async (
    chosen: readonly ImportCollection[],
    subject: { label: string; color: string | null },
    apply: (target: ImportTarget) => void,
  ) => {
    const [base] = chosen;
    if (base == null) {
      return;
    }
    const current = appliedTargets[base.collectionKey];
    const newCategory =
      current?.kind === 'NEW_CATEGORY'
        ? current
        : toNewCategoryTarget(base, { palette: CATEGORY_COLORS, names });
    const nextIfNew = {
      ...appliedTargets,
      ...Object.fromEntries(chosen.map((collection) => [collection.collectionKey, newCategory])),
    };
    const canCreateCategory =
      remainingCategorySlots == null ||
      TodoImportTargetPolicy.countNewCategories(Object.values(nextIfNew)) <= remainingCategorySlots;

    const choice = await openSheet<CategoryTargetChoice>((close) => (
      <CategoryTargetSheet
        subject={subject.label}
        subjectColor={subject.color}
        newCategory={pick(newCategory, ['name', 'color'])}
        sameNameCategoryId={
          TodoImportTargetPolicy.findSameNameCategory(newCategory, categories)?.id ?? null
        }
        canCreateCategory={canCreateCategory}
        freeCategoryLimit={freeCategoryLimit}
        defaultCategoryId={
          current?.kind === 'EXISTING_CATEGORY'
            ? current.categoryId
            : (TodoCategoryPolicy.findInitialCategoryId(categories, null) ?? 0)
        }
        onChoose={close}
      />
    ));
    if (choice == null) {
      return;
    }

    match(choice)
      .with({ kind: 'NEW_CATEGORY' }, { kind: 'EXISTING_CATEGORY' }, apply)
      .with({ kind: 'NEW_CATEGORY_LOCKED' }, () => gate.promptLimit())
      .with({ kind: 'NEW_CATEGORY_EDIT' }, () =>
        openKeyboardSheet(({ isOpen, onOpenChange }) => (
          <CategoryTargetSheet.NewCategory
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            defaultValues={pick(newCategory, ['name', 'color'])}
            onConfirm={(edited) => {
              apply({ kind: 'NEW_CATEGORY', ...edited });
              onOpenChange(false);
            }}
          />
        )),
      )
      .exhaustive();
  };

  const applyToCollection = (collectionKey: string) => (target: ImportTarget) =>
    onValueChange({ ...targets, [collectionKey]: target });

  const [firstCollection] = collections;
  const singleRowTarget =
    firstCollection == null ? null : (appliedTargets[firstCollection.collectionKey] ?? null);
  const firstErrorMessage =
    collections
      .map((collection) => errorMessages?.[collection.collectionKey])
      .find((message) => message != null) ?? null;
  // 고른 곳이 남은 자리보다 많을 때만 눈에 띄게 알린다. 그 밖에는 차분한 안내다
  const isOverSlots = remainingCategorySlots != null && newCategoryCount > remainingCategorySlots;

  return (
    <VStack gap={8}>
      {match(mode)
        .with('separate', () => (
          <SettingsListGroup>
            {collections.map((collection, index) => (
              <Box key={collection.collectionKey}>
                {index > 0 && <SettingsListGroup.Separator />}
                <CategoryMappingList.Item
                  label={collection.title}
                  color={collection.color}
                  target={targets[collection.collectionKey] ?? null}
                  categories={categories}
                  errorMessage={errorMessages?.[collection.collectionKey] ?? null}
                  onPress={() =>
                    chooseTarget(
                      [collection],
                      {
                        label: t('categories.sheet.calendar', { name: collection.title }),
                        color: collection.color,
                      },
                      applyToCollection(collection.collectionKey),
                    )
                  }
                />
              </Box>
            ))}
          </SettingsListGroup>
        ))
        .with('single', () => (
          <SettingsListGroup>
            <CategoryMappingList.Item
              label={t('categories.allCalendars', { count: collections.length })}
              color={null}
              target={singleRowTarget}
              categories={categories}
              errorMessage={firstErrorMessage}
              onPress={() =>
                chooseTarget(
                  collections,
                  {
                    label: t('categories.allCalendars', { count: collections.length }),
                    color: null,
                  },
                  onSingleTargetChange,
                )
              }
            />
          </SettingsListGroup>
        ))
        .exhaustive()}

      {remainingCategorySlots != null && (
        <Box className="px-4">
          <WordWrapText size="b4" shade={6} tone={isOverSlots ? 'warning' : 'neutral'}>
            {remainingCategorySlots === 0
              ? t('categories.noSlots')
              : t('categories.remainingSlots', { count: remainingCategorySlots })}
          </WordWrapText>
        </Box>
      )}
    </VStack>
  );
}

interface ItemProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'description' | 'icon' | 'value' | 'right' | 'accessibilityLabel'
> {
  /** 캘린더 색. 모은 행은 null이다 */
  color: string | null;
  target: ImportTarget | null;
  categories: readonly TodoCategoryWithCount[];
  errorMessage: string | null;
}

/** 설정 행처럼 왼쪽은 무엇을, 오른쪽은 넣을 카테고리를 글로 보인다. 새로 만들 카테고리는 둘째 줄이 알린다 */
CategoryMappingList.Item = function Item({
  label,
  color,
  target,
  categories,
  errorMessage,
  ...props
}: ItemProps) {
  const { t } = useTranslation('todoImport');
  const { name: targetName, color: targetColor } = match(target)
    .returnType<{ name: string; color: string | null }>()
    .with(null, () => ({ name: t('categories.unassigned'), color: null }))
    .with({ kind: 'NEW_CATEGORY' }, ({ name, color: newColor }) => ({ name, color: newColor }))
    .with({ kind: 'EXISTING_CATEGORY' }, ({ categoryId }) => {
      const category = TodoCategoryPolicy.findCategory(categories, categoryId);
      return {
        name: category?.name ?? t('categories.unassigned'),
        color: category?.color ?? null,
      };
    })
    .exhaustive();
  const description =
    target?.kind === 'NEW_CATEGORY' ? t('categories.newCategoryDescription') : undefined;

  return (
    <VStack>
      <SettingsListGroup.Item
        label={label}
        description={description}
        icon={color == null ? undefined : <ColorDot color={color} />}
        value={
          <HStack align="center" gap={6} className="shrink">
            {targetColor != null && <ColorDot color={targetColor} />}
            <SettingsListGroup.Value numberOfLines={1} className="shrink">
              {targetName}
            </SettingsListGroup.Value>
          </HStack>
        }
        accessibilityLabel={compact([
          t('categories.rowLabel', { calendar: label, target: targetName }),
          description,
          errorMessage,
        ]).join(', ')}
        accessibilityHint={t('categories.rowHint')}
        {...props}
      />
      {errorMessage != null && (
        <Box className="px-4 pb-3">
          <WordWrapText size="b4" tone="danger">
            {errorMessage}
          </WordWrapText>
        </Box>
      )}
    </VStack>
  );
};

/** 고른 캘린더 수만큼 같은 높이의 행을 그린다 */
CategoryMappingList.Loading = function Loading({
  rowCount = DEFAULT_LOADING_ROW_COUNT,
}: {
  rowCount?: number;
}) {
  return (
    <SettingsListGroup>
      {range(rowCount).map((index) => (
        <Box key={index}>
          {index > 0 && <SettingsListGroup.Separator />}
          <SettingsListGroup.Item.Loading hasValue />
        </Box>
      ))}
    </SettingsListGroup>
  );
};

CategoryMappingList.Error = SettingsListGroup.Error;

function ColorDot({ color }: { color: string }) {
  return <Box className="size-2.5 rounded-full" style={{ backgroundColor: color }} />;
}
