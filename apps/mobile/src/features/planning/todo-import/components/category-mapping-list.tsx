import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import { HStack, SettingsListGroup, TextSkeleton, VStack, WordWrapText } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { compact, range } from 'es-toolkit';
import { type ComponentProps, Fragment } from 'react';

import type { TodoImportCollection } from '../domains/todo-import-collection.model';
import { TodoImportPlacementPolicy } from '../domains/todo-import-placement.model';
import { type TodoImportPlan, TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import { createDefaultTarget, type TodoImportTarget } from '../domains/todo-import-target.model';
import { useFormatImportTargetName } from '../hooks/use-format-import-target-name';
import { useFormatPlacementStatus } from '../hooks/use-format-placement-status';
import { useNewCategoryDefaults } from '../hooks/use-new-category-defaults';
import { useOpenCategoryTargetSheet } from '../hooks/use-open-category-target-sheet';
import { useSuspenseTodoImportPlacements } from '../hooks/use-suspense-todo-import-placements';
import {
  findTargetAppearance,
  getCalendarSourceLabelKey,
  groupCollectionsBySource,
  type TodoImportTargetAppearance,
} from '../utils/todo-import.view-model';
import { AidoMark } from './aido-mark';
import { CalendarSourceBadge } from './calendar-source-badge';
import { ColorDot } from './color-dot';

interface CategoryMappingListProps {
  plan: TodoImportPlan;
  // 서버가 넣을 곳을 받지 않은 캘린더의 사유. 키는 캘린더 키다
  errorMessages: Readonly<Record<string, string>>;
  onItemChange: (collectionKey: string, target: TodoImportTarget) => void;
}

// 캘린더가 이보다 많으면 출처 계정마다 나눠 묶는다
const GROUP_THRESHOLD_COUNT = 8;

// 캘린더마다 넣을 곳. 줄마다 "다른 서비스의 캘린더 → 아이두 카테고리"로 읽히고, 누르면 그 줄의 넣을 곳을 고르게 한다.
// 고른 카테고리의 서버 한도만 읽어, 자리가 모자라 일정을 건너뛰는 줄에 경고를 단다.
// 캘린더가 많으면 출처 계정마다 묶어 배지 대신 묶음 이름으로 알린다
export function CategoryMappingList({
  plan,
  errorMessages,
  onItemChange,
}: CategoryMappingListProps) {
  const { t } = useTranslation('todoImport');
  const newCategoryDefaults = useNewCategoryDefaults();
  const formatPlacementStatus = useFormatPlacementStatus();
  const openTargetSheet = useOpenCategoryTargetSheet();

  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const placements = useSuspenseTodoImportPlacements({ plan });

  const { categories } = categoriesResult;
  const defaultTarget = createDefaultTarget(categories, newCategoryDefaults);

  const handleItemPress = (collection: TodoImportCollection) => {
    const current = TodoImportPlanPolicy.findTarget(plan, defaultTarget, collection.collectionKey);
    if (current == null) {
      return;
    }
    openTargetSheet({
      subject: { kind: 'calendar', collection },
      current,
      otherTargets: TodoImportPlanPolicy.getOtherTargets(
        plan,
        defaultTarget,
        collection.collectionKey,
      ),
      onChoose: (target) => onItemChange(collection.collectionKey, target),
    });
  };

  // 줄마다 넣을 곳의 겉모습과 자리 경고를 붙인다
  const getItemProps = (collection: TodoImportCollection) => {
    const target = TodoImportPlanPolicy.findTarget(plan, defaultTarget, collection.collectionKey);
    const appearance = target == null ? null : findTargetAppearance(target, categories);
    const placement =
      target == null ? null : TodoImportPlacementPolicy.findByTarget(placements, target);
    const status =
      appearance == null || placement == null
        ? null
        : formatPlacementStatus(placement, appearance.name);

    return {
      collection,
      appearance,
      warningMessage: status?.isWarning === true ? status.message : null,
      errorMessage: errorMessages[collection.collectionKey] ?? null,
      onPress: () => handleItemPress(collection),
    };
  };

  if (plan.collections.length <= GROUP_THRESHOLD_COUNT) {
    return (
      <SettingsListGroup>
        {plan.collections.map((collection, index) => (
          <Fragment key={collection.collectionKey}>
            {index > 0 && <SettingsListGroup.Separator />}
            <CategoryMappingList.Item {...getItemProps(collection)} isBadgeShown />
          </Fragment>
        ))}
      </SettingsListGroup>
    );
  }

  return (
    <VStack gap={12}>
      {groupCollectionsBySource(plan.collections).map((group) => (
        <SettingsListGroup
          key={group.sourceKey}
          label={compact([t(getCalendarSourceLabelKey(group.provider)), group.accountLabel]).join(
            ' · ',
          )}
        >
          {group.collections.map((collection, index) => (
            <Fragment key={collection.collectionKey}>
              {index > 0 && <SettingsListGroup.Separator />}
              <CategoryMappingList.Item {...getItemProps(collection)} isBadgeShown={false} />
            </Fragment>
          ))}
        </SettingsListGroup>
      ))}
    </VStack>
  );
}

interface NoteProps extends Omit<ComponentProps<typeof WordWrapText>, 'children'> {
  plan: TodoImportPlan;
}

// 따로 고르지 않은 캘린더가 들어갈 곳. 목록과 같은 경계 안에서 같은 카테고리 캐시를 읽는다
CategoryMappingList.Note = function Note({ plan, ...props }: NoteProps) {
  const { t } = useTranslation('todoImport');
  const newCategoryDefaults = useNewCategoryDefaults();
  const formatTargetName = useFormatImportTargetName();

  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());

  const destination = TodoImportPlanPolicy.getDestination(
    plan,
    createDefaultTarget(categoriesResult.categories, newCategoryDefaults),
  );

  return (
    <WordWrapText size="b4" shade={6} {...props}>
      {t('categories.separate.note', {
        // 문장 안에서는 "새 · " 표시 없이 이름만 쓴다
        name:
          findTargetAppearance(destination, categoriesResult.categories)?.name ??
          formatTargetName(null),
      })}
    </WordWrapText>
  );
};

interface ItemProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'label' | 'description' | 'icon' | 'value' | 'right' | 'accessibilityLabel'
> {
  collection: TodoImportCollection;
  // 묶음 이름이 출처를 알리면 줄마다 배지를 두지 않는다
  isBadgeShown: boolean;
  // 넣을 아이두 카테고리. 고른 카테고리가 삭제됐으면 null이다
  appearance: TodoImportTargetAppearance | null;
  // 자리가 모자라 이 줄의 일정 일부를 건너뛸 때의 안내
  warningMessage: string | null;
  errorMessage: string | null;
}

/** 왼쪽은 다른 서비스의 캘린더, 오른쪽은 넣을 아이두 카테고리다. 이름이 길면 줄임표로 줄고 사라지지 않는다 */
CategoryMappingList.Item = function Item({
  collection,
  isBadgeShown,
  appearance,
  warningMessage,
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
            source: t(getCalendarSourceLabelKey(collection.accountProvider)),
            calendar: collection.title,
            target: appearance?.name ?? targetName,
          }),
          warningMessage,
          errorMessage,
        ]).join(', ')}
        accessibilityHint={t('categories.rowHint')}
        {...props}
      />
      {(warningMessage != null || errorMessage != null) && (
        <VStack gap={2} className="px-4 pb-3">
          {warningMessage != null && (
            <WordWrapText size="b4" tone="warning" className="tabular-nums">
              {warningMessage}
            </WordWrapText>
          )}
          {errorMessage != null && (
            <WordWrapText size="b4" tone="danger">
              {errorMessage}
            </WordWrapText>
          )}
        </VStack>
      )}
    </VStack>
  );
};

interface LoadingProps {
  rowCount: number;
}

// 고른 캘린더 수만큼 같은 높이의 행을 그리고, 받은 뒤 목록 아래에 나타나는 안내 글(`.Note`) 한 줄 자리를 함께 잡는다
CategoryMappingList.Loading = function Loading({ rowCount }: LoadingProps) {
  return (
    <VStack gap={8}>
      <SettingsListGroup>
        {range(Math.min(rowCount, GROUP_THRESHOLD_COUNT)).map((index) => (
          <Fragment key={index}>
            {index > 0 && <SettingsListGroup.Separator />}
            <SettingsListGroup.Item.Loading hasValue />
          </Fragment>
        ))}
      </SettingsListGroup>
      <TextSkeleton size="b4" className="w-48" />
    </VStack>
  );
};

CategoryMappingList.Error = SettingsListGroup.Error;
