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

import type { ImportCollection } from '../domains/todo-import-collection.model';
import {
  findTargetPlacement,
  type ImportTarget,
  type TargetPlacement,
} from '../domains/todo-import-target.model';
import { useFormatImportTargetName } from '../hooks/use-format-import-target-name';
import { useFormatPlacementStatus } from '../hooks/use-format-placement-status';
import { useImportPlacements } from '../hooks/use-import-placements';
import { findTargetAppearance, type ImportTargetAppearance } from '../utils/todo-import.view-model';
import { AidoMark } from './aido-mark';
import { ColorDot } from './color-dot';

interface ImportDestinationButtonProps extends Omit<CardProps, 'appearance' | 'placement'> {
  /** 모두 넣을 곳 */
  target: ImportTarget;
  collections: readonly ImportCollection[];
}

const ARROW_SIZE = 16;

/** 가져온 일정이 들어갈 아이두 카테고리. 이 카테고리의 서버 한도만 읽어 몇 개가 들어가는지 센다 */
export function ImportDestinationButton({
  target,
  collections,
  ...props
}: ImportDestinationButtonProps) {
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const targets = Object.fromEntries(
    collections.map(({ collectionKey }) => [collectionKey, target]),
  );
  const placements = useImportPlacements(collections, targets);

  return (
    <ImportDestinationButton.Card
      appearance={findTargetAppearance(target, categoriesResult.categories)}
      placement={findTargetPlacement(placements, target)}
      {...props}
    />
  );
}

interface CardProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel' | 'accessibilityRole'
> {
  /** 넣을 아이두 카테고리. 고른 카테고리가 삭제됐으면 null이다 */
  appearance: ImportTargetAppearance | null;
  /** 몇 개가 들어가고 몇 개를 건너뛰는지. null이면 둘째 줄이 없다 */
  placement: TargetPlacement | null;
  /** 서버가 이곳을 받지 않은 이유 */
  errorMessage: string | null;
}

/**
 * 눌러서 바꾸는 넣을 곳 카드. 둘째 줄은 더 넣을 수 있는 수이고, 모자라면 몇 개를 건너뛰는지 경고로 알린다.
 * 넘쳐도 막지 않는다(서버가 가까운 날짜부터 넣는다)
 */
ImportDestinationButton.Card = function Card({
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
          <AidoMark />
          {appearance != null && <ColorDot color={appearance.color} />}
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
ImportDestinationButton.Loading = function Loading() {
  return (
    <VStack className="gap-1 rounded-2xl border-2 border-gray-3 bg-gray-1 px-4 py-3">
      <HStack align="center" gap={8}>
        <Skeleton className="size-4 rounded-[4px]" />
        <TextSkeleton size="b2" className="w-24" />
      </HStack>
      <TextSkeleton size="b4" className="w-40" />
    </VStack>
  );
};

/** 카드 자리에서 다시 시도한다 */
ImportDestinationButton.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoImport');

  return (
    <QueryErrorFallback.Inline
      message={t('categories.loadFailed')}
      reset={reset}
      className="rounded-2xl bg-gray-1 px-4 py-3"
    />
  );
};
