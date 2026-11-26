import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { compact } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import {
  type TodoImportPlacement,
  TodoImportPlacementPolicy,
} from '../domains/todo-import-placement.model';
import { type TodoImportPlan, TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import { createDefaultTarget, type TodoImportTarget } from '../domains/todo-import-target.model';
import { useFormatImportTargetName } from '../hooks/use-format-import-target-name';
import { useFormatPlacementStatus } from '../hooks/use-format-placement-status';
import { useNewCategoryDefaults } from '../hooks/use-new-category-defaults';
import { useOpenCategoryTargetSheet } from '../hooks/use-open-category-target-sheet';
import { useSuspenseTodoImportPlacements } from '../hooks/use-suspense-todo-import-placements';
import {
  findTargetAppearance,
  type TodoImportTargetAppearance,
} from '../utils/todo-import.view-model';
import { AidoDestinationMark } from './aido-destination-mark';
import { CategoryColorDot } from './category-color-dot';

interface ImportDestinationInputProps extends Omit<CardProps, 'appearance' | 'placement'> {
  plan: TodoImportPlan;
  onChange: (target: TodoImportTarget) => void;
}

const ARROW_SIZE = 16;

// 가져온 일정을 모두 넣을 아이두 카테고리. 누르면 넣을 곳을 고르게 하고, 이 카테고리의 서버 한도만 읽어 몇 개가 들어가는지 센다
export function ImportDestinationInput({
  plan,
  onChange,
  onPress,
  ...props
}: ImportDestinationInputProps) {
  const newCategoryDefaults = useNewCategoryDefaults();
  const openTargetSheet = useOpenCategoryTargetSheet();

  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const placements = useSuspenseTodoImportPlacements({ plan });

  const destination = TodoImportPlanPolicy.getDestination(
    plan,
    createDefaultTarget(categoriesResult.categories, newCategoryDefaults),
  );
  const [firstCollection] = plan.collections;

  const openDestinationSheet = () => {
    if (firstCollection == null) {
      return;
    }
    openTargetSheet({
      subject: TodoImportPlanPolicy.canSplit(plan)
        ? { kind: 'allCalendars', collections: plan.collections }
        : { kind: 'calendar', collection: firstCollection },
      current: destination,
      otherTargets: [],
      onChoose: onChange,
    });
  };

  return (
    <ImportDestinationInput.Card
      appearance={findTargetAppearance(destination, categoriesResult.categories)}
      placement={TodoImportPlacementPolicy.findByTarget(placements, destination)}
      {...props}
      onPress={(event) => {
        openDestinationSheet();
        // 감싼 코치마크(Popover.Trigger asChild)가 넣은 onPress를 시트 열기 뒤에 이어 불러, 같은 탭이 안내도 닫는다
        if (typeof onPress === 'function') {
          onPress(event);
        }
      }}
    />
  );
}

interface CardProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel' | 'accessibilityRole'
> {
  // 넣을 아이두 카테고리. 고른 카테고리가 삭제됐으면 null이다
  appearance: TodoImportTargetAppearance | null;
  // 몇 개가 들어가고 몇 개를 건너뛰는지. null이면 둘째 줄이 없다
  placement: TodoImportPlacement | null;
  // 서버가 이곳을 받지 않은 이유
  errorMessage: string | null;
}

/**
 * 눌러서 바꾸는 넣을 곳 카드. 둘째 줄은 더 넣을 수 있는 수이고, 모자라면 몇 개를 건너뛰는지 경고로 알린다.
 * 넘쳐도 막지 않는다(서버가 가까운 날짜부터 넣는다)
 */
ImportDestinationInput.Card = function Card({
  appearance,
  placement,
  errorMessage,
  className,
  ...props
}: CardProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const formatTargetName = useFormatImportTargetName();
  const formatPlacementStatus = useFormatPlacementStatus();

  const name = formatTargetName(appearance);
  const status =
    appearance == null || placement == null
      ? null
      : formatPlacementStatus(placement, appearance.name);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={compact([
        t('categories.destinationLabel'),
        name,
        status?.message,
        errorMessage,
        t('categories.change'),
      ]).join(', ')}
      className={cn('rounded-2xl border-2 border-main bg-gray-1 px-4 py-3', className)}
      {...props}
    >
      <PressableFeedback.Highlight className="rounded-2xl" />
      <VStack gap={4}>
        <HStack align="center" gap={8}>
          <AidoDestinationMark />
          {appearance != null && <CategoryColorDot color={appearance.color} />}
          <Text size="b2" weight="semibold" shade={9} numberOfLines={1} className="shrink grow">
            {name}
          </Text>
          <HStack align="center" gap={2}>
            <Text size="b3" shade={6}>
              {t('categories.change')}
            </Text>
            <ArrowRightIcon
              width={fontScaledSize(ARROW_SIZE)}
              height={fontScaledSize(ARROW_SIZE)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </HStack>
        {status != null && (
          <Text
            size="b4"
            shade={6}
            tone={status.isWarning ? 'warning' : 'neutral'}
            lineBreakStrategyIOS="hangul-word"
            className="tabular-nums"
          >
            {status.message}
          </Text>
        )}
        {errorMessage != null && (
          <Text size="b4" tone="danger" lineBreakStrategyIOS="hangul-word">
            {errorMessage}
          </Text>
        )}
      </VStack>
    </PressableFeedback>
  );
};

/** 받은 뒤와 같은 테두리·두 줄 높이 */
ImportDestinationInput.Loading = function Loading() {
  return (
    <VStack className="gap-1 rounded-2xl border-2 border-gray-3 bg-gray-1 px-4 py-3">
      <HStack align="center" gap={8}>
        <Skeleton className="size-4 rounded-sm" />
        <TextSkeleton size="b2" className="w-24" />
      </HStack>
      <TextSkeleton size="b4" className="w-40" />
    </VStack>
  );
};

/** 카드 자리에서 다시 시도한다 */
ImportDestinationInput.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoImport');

  return (
    <QueryErrorFallback.Inline
      message={t('categories.loadFailed')}
      reset={reset}
      className="rounded-2xl bg-gray-1 px-4 py-3"
    />
  );
};
