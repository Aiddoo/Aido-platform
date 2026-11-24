import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { compact } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match, P } from 'ts-pattern';

import { useFormatImportTargetName } from '../hooks/use-format-import-target-name';
import type { ImportTargetAppearance } from '../utils/todo-import.view-model';
import { AidoMark } from './aido-mark';

interface ImportDestinationButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel' | 'accessibilityRole'
> {
  /** 넣을 아이두 카테고리. 고른 카테고리가 삭제됐으면 null이다 */
  appearance: ImportTargetAppearance | null;
  /** 카테고리에 더 넣을 수 있는 할 일 수 */
  roomLeft: number;
  /** 자리가 모자라 건너뛸 일정 수 */
  skippedCount: number;
  /** 서버가 이곳을 받지 않은 이유 */
  errorMessage: string | null;
}

const ARROW_SIZE = 16;

/**
 * 가져온 일정이 들어갈 아이두 카테고리. 눌러서 바꾼다. 둘째 줄은 더 넣을 수 있는 수이고, 모자라면 몇 개를
 * 건너뛰는지 경고로 알린다. 넘쳐도 막지 않는다(서버가 가까운 날짜부터 넣는다)
 */
export function ImportDestinationButton({
  appearance,
  roomLeft,
  skippedCount,
  errorMessage,
  className,
  ...props
}: ImportDestinationButtonProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const formatTargetName = useFormatImportTargetName();

  const isOverflowing = 0 < skippedCount;
  const name = formatTargetName(appearance);
  const status = match({ appearance, isOverflowing })
    .with({ appearance: null }, () => null)
    .with({ appearance: P.nonNullable, isOverflowing: true }, ({ appearance: { name: target } }) =>
      t('categories.overflow', { name: target, count: roomLeft, skipped: skippedCount }),
    )
    .otherwise(() => t('categories.roomLeft', { count: roomLeft }));

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={compact([
        t('categories.destinationAccessibility', { name, status: status ?? '' }),
        errorMessage,
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
            tone={isOverflowing ? 'warning' : 'neutral'}
            lineBreakStrategyIOS="hangul-word"
            className="tabular-nums"
          >
            {status}
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
}

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

function ColorDot({ color }: { color: string }) {
  return <Box className="size-2.5 rounded-full" style={{ backgroundColor: color }} />;
}
