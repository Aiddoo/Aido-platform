import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, SettingsListGroup, VStack, WordWrapText } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { compact, range } from 'es-toolkit';
import { type ComponentProps, Fragment } from 'react';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import type { ImportTarget } from '../domains/todo-import-target.model';
import { useFormatImportTargetName } from '../hooks/use-format-import-target-name';
import {
  CALENDAR_SOURCE_LABEL_KEYS,
  findTargetAppearance,
  groupCollectionsBySource,
  type ImportTargetAppearance,
} from '../utils/todo-import.view-model';
import { AidoMark } from './aido-mark';
import { CalendarSourceBadge } from './calendar-source-badge';

interface CategoryMappingListProps {
  collections: readonly ImportCollection[];
  /** 캘린더마다 넣을 곳. 고르지 않은 캘린더도 모두 넣을 곳으로 채워져 있다 */
  targets: Readonly<Record<string, ImportTarget>>;
  errorMessages: Readonly<Record<string, string>>;
  onItemPress: (collection: ImportCollection) => void;
}

/** 캘린더가 이보다 많으면 출처 계정마다 나눠 묶는다 */
const GROUP_THRESHOLD_COUNT = 8;

/**
 * 캘린더마다 넣을 곳. 줄마다 "다른 서비스의 캘린더 → 아이두 카테고리"로 읽히고, 누르면 그 줄의 넣을 곳을 바꾼다.
 * 캘린더가 많으면 출처 계정마다 묶어 배지 대신 묶음 이름으로 알린다
 */
export function CategoryMappingList({
  collections,
  targets,
  errorMessages,
  onItemPress,
}: CategoryMappingListProps) {
  const { t } = useTranslation('todoImport');
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const renderItem = (collection: ImportCollection, isBadgeShown: boolean) => {
    const target = targets[collection.collectionKey];
    return (
      <CategoryMappingList.Item
        collection={collection}
        isBadgeShown={isBadgeShown}
        appearance={
          target == null ? null : findTargetAppearance(target, categoriesResult.categories)
        }
        errorMessage={errorMessages[collection.collectionKey] ?? null}
        onPress={() => onItemPress(collection)}
      />
    );
  };

  if (collections.length <= GROUP_THRESHOLD_COUNT) {
    return (
      <SettingsListGroup>
        {collections.map((collection, index) => (
          <Fragment key={collection.collectionKey}>
            {index > 0 && <SettingsListGroup.Separator />}
            {renderItem(collection, true)}
          </Fragment>
        ))}
      </SettingsListGroup>
    );
  }

  return (
    <VStack gap={12}>
      {groupCollectionsBySource(collections).map((group) => (
        <SettingsListGroup
          key={group.sourceKey}
          label={compact([t(CALENDAR_SOURCE_LABEL_KEYS[group.provider]), group.accountLabel]).join(
            ' · ',
          )}
        >
          {group.collections.map((collection, index) => (
            <Fragment key={collection.collectionKey}>
              {index > 0 && <SettingsListGroup.Separator />}
              {renderItem(collection, false)}
            </Fragment>
          ))}
        </SettingsListGroup>
      ))}
    </VStack>
  );
}

interface ItemProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'label' | 'description' | 'icon' | 'value' | 'right' | 'accessibilityLabel'
> {
  collection: ImportCollection;
  /** 묶음 이름이 출처를 알리면 줄마다 배지를 두지 않는다 */
  isBadgeShown: boolean;
  /** 넣을 아이두 카테고리. 고른 카테고리가 삭제됐으면 null이다 */
  appearance: ImportTargetAppearance | null;
  errorMessage: string | null;
}

/** 왼쪽은 다른 서비스의 캘린더, 오른쪽은 넣을 아이두 카테고리다. 이름이 길면 줄임표로 줄고 사라지지 않는다 */
CategoryMappingList.Item = function Item({
  collection,
  isBadgeShown,
  appearance,
  errorMessage,
  ...props
}: ItemProps) {
  const { t } = useTranslation('todoImport');
  const formatTargetName = useFormatImportTargetName();
  const targetName = formatTargetName(appearance);

  return (
    <VStack>
      <SettingsListGroup.Item
        label={collection.title}
        icon={
          isBadgeShown ? <CalendarSourceBadge provider={collection.accountProvider} /> : undefined
        }
        value={
          <HStack align="center" gap={6} className="shrink">
            <AidoMark />
            {appearance != null && <ColorDot color={appearance.color} />}
            <SettingsListGroup.Value numberOfLines={1} className="shrink">
              {targetName}
            </SettingsListGroup.Value>
          </HStack>
        }
        accessibilityLabel={compact([
          t('categories.rowLabel', {
            source: t(CALENDAR_SOURCE_LABEL_KEYS[collection.accountProvider]),
            calendar: collection.title,
            target: targetName,
          }),
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
CategoryMappingList.Loading = function Loading({ rowCount }: { rowCount: number }) {
  return (
    <SettingsListGroup>
      {range(Math.min(rowCount, GROUP_THRESHOLD_COUNT)).map((index) => (
        <Fragment key={index}>
          {index > 0 && <SettingsListGroup.Separator />}
          <SettingsListGroup.Item.Loading hasValue />
        </Fragment>
      ))}
    </SettingsListGroup>
  );
};

CategoryMappingList.Error = SettingsListGroup.Error;

function ColorDot({ color }: { color: string }) {
  return <Box className="size-2.5 rounded-full" style={{ backgroundColor: color }} />;
}
