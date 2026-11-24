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
  InlineAlert,
  LabelChip,
  ListRow,
  SettingsListGroup,
  Text,
  TextButton,
  TextSkeleton,
  useOpenKeyboardSheet,
  useOpenSheet,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { compact, pick, range } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { resolveImportTargets, toNewCategoryTarget } from '../apis/todo-import-target.mapper';
import type { ImportCollection } from '../domains/todo-import-collection.model';
import { type ImportTarget, TodoImportTargetPolicy } from '../domains/todo-import-target.model';
import { useNewCategoryNames } from '../hooks/use-new-category-names';
import { type CategoryTargetChoice, CategoryTargetSheet } from './category-target-sheet';

interface CategoryMappingListProps {
  collections: readonly ImportCollection[];
  /** 없는 캘린더는 기본 연결 규칙을 보인다 */
  value: Readonly<Record<string, ImportTarget>>;
  onValueChange: (targets: Record<string, ImportTarget>) => void;
  errorMessages?: Readonly<Record<string, string>>;
}

const DEFAULT_LOADING_ROW_COUNT = 3;

export function CategoryMappingList({
  collections,
  value,
  onValueChange,
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
  const names = useNewCategoryNames();
  const targets = resolveImportTargets(collections, value, {
    categories,
    remainingCategorySlots,
    palette: CATEGORY_COLORS,
    names,
  });
  const newCategoryCount = TodoImportTargetPolicy.countNewCategories(Object.values(targets));

  const chooseTarget = async (
    chosenKeys: readonly string[],
    base: ImportCollection,
    title: string,
  ) => {
    const current = targets[base.collectionKey];
    const newCategory =
      current?.kind === 'NEW_CATEGORY'
        ? current
        : toNewCategoryTarget(base, { palette: CATEGORY_COLORS, names });
    const nextIfNew = {
      ...targets,
      ...Object.fromEntries(chosenKeys.map((key) => [key, newCategory])),
    };
    const canCreateCategory =
      remainingCategorySlots == null ||
      TodoImportTargetPolicy.countNewCategories(Object.values(nextIfNew)) <= remainingCategorySlots;

    const choice = await openSheet<CategoryTargetChoice>((close) => (
      <CategoryTargetSheet
        title={title}
        newCategory={pick(newCategory, ['name', 'color'])}
        canCreateCategory={canCreateCategory}
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
    const applyToChosen = (target: ImportTarget) =>
      onValueChange({
        ...value,
        ...Object.fromEntries(chosenKeys.map((key) => [key, target])),
      });

    match(choice)
      .with({ kind: 'NEW_CATEGORY' }, { kind: 'EXISTING_CATEGORY' }, applyToChosen)
      .with({ kind: 'NEW_CATEGORY_LOCKED' }, () => gate.promptLimit())
      .with({ kind: 'NEW_CATEGORY_EDIT' }, () =>
        openKeyboardSheet(({ isOpen, onOpenChange }) => (
          <CategoryTargetSheet.NewCategory
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            defaultValues={pick(newCategory, ['name', 'color'])}
            onConfirm={(edited) => {
              applyToChosen({ kind: 'NEW_CATEGORY', ...edited });
              onOpenChange(false);
            }}
          />
        )),
      )
      .exhaustive();
  };

  const [firstCollection] = collections;

  return (
    <VStack gap={12}>
      {remainingCategorySlots != null && (
        <InlineAlert
          status={
            remainingCategorySlots === 0 || newCategoryCount > remainingCategorySlots
              ? 'warning'
              : 'default'
          }
          title={
            remainingCategorySlots === 0
              ? t('categories.noSlots')
              : t('categories.remainingSlots', { count: remainingCategorySlots })
          }
        />
      )}

      <SettingsListGroup>
        {collections.map((collection, index) => (
          <Box key={collection.collectionKey}>
            {index > 0 && <SettingsListGroup.Separator />}
            <CategoryMappingList.Item
              collection={collection}
              target={targets[collection.collectionKey] ?? null}
              categories={categories}
              errorMessage={errorMessages?.[collection.collectionKey] ?? null}
              onPress={() => chooseTarget([collection.collectionKey], collection, collection.title)}
            />
          </Box>
        ))}
      </SettingsListGroup>

      {firstCollection != null && collections.length > 1 && (
        <TextButton
          size="medium"
          className="self-start"
          onPress={() =>
            chooseTarget(
              collections.map((collection) => collection.collectionKey),
              firstCollection,
              t('categories.allInOne'),
            )
          }
        >
          {t('categories.allInOne')}
        </TextButton>
      )}
    </VStack>
  );
}

interface ItemProps {
  collection: ImportCollection;
  target: ImportTarget | null;
  categories: readonly TodoCategoryWithCount[];
  errorMessage: string | null;
  onPress: () => void;
}

CategoryMappingList.Item = function Item({
  collection,
  target,
  categories,
  errorMessage,
  onPress,
}: ItemProps) {
  const { t } = useTranslation('todoImport');
  const targetLabel = match(target)
    .with(null, () => t('categories.unassigned'))
    .with({ kind: 'NEW_CATEGORY' }, ({ name }) => t('categories.newCategoryChip', { name }))
    .with(
      { kind: 'EXISTING_CATEGORY' },
      ({ categoryId }) =>
        TodoCategoryPolicy.findCategory(categories, categoryId)?.name ?? t('categories.unassigned'),
    )
    .exhaustive();

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={compact([
        t('categories.rowLabel', { calendar: collection.title, target: targetLabel }),
        errorMessage,
      ]).join(', ')}
      accessibilityHint={t('categories.rowHint')}
      onPress={onPress}
    >
      <VStack gap={4} className="px-4 py-3">
        <ListRow
          verticalPadding="small"
          left={
            <Box
              className="size-2.5 rounded-full bg-gray-4"
              style={collection.color == null ? undefined : { backgroundColor: collection.color }}
            />
          }
          contents={
            <Text size="b2" shade={8} numberOfLines={2}>
              {collection.title}
            </Text>
          }
          right={
            // 좁아지면 카테고리 칩이 먼저 줄어 캘린더 이름이 단어 중간에서 꺾이지 않는다
            <HStack align="center" className="max-w-1/2 shrink">
              <LabelChip
                size="md"
                color={errorMessage == null ? 'accent' : 'danger'}
                label={targetLabel}
                labelProps={{ numberOfLines: 1 }}
              />
            </HStack>
          }
        />
        {errorMessage != null && (
          <WordWrapText size="b4" tone="danger">
            {errorMessage}
          </WordWrapText>
        )}
      </VStack>
    </PressableFeedback>
  );
};

/** 캘린더 단계에서 고른 수만큼 같은 높이의 행을 그린다 */
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
          <Box className="px-4 py-3">
            <ListRow
              verticalPadding="small"
              left={<Skeleton className="size-2.5 rounded-full" />}
              contents={<TextSkeleton size="b2" className="w-24" />}
              right={<Skeleton className="h-7 w-20 rounded-full" />}
            />
          </Box>
        </Box>
      ))}
    </SettingsListGroup>
  );
};

CategoryMappingList.Error = SettingsListGroup.Error;
