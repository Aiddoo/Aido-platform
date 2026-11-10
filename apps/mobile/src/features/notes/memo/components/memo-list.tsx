import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useStartVoiceNote } from '@src/features/voice/hooks/use-start-voice-note';
import { useVoiceNotes } from '@src/features/voice/hooks/use-voice-notes';
import { formatYearAwareDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  HStack,
  MemoIllustration,
  PinFilledIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  usePaneSizeClass,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { clamp, range } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { match, P } from 'ts-pattern';

import type { Memo } from '../domains/memo.model';
import { useSelectedMemoId } from '../hooks/use-memo-params';
import { useGetMemosInfiniteQueryOptions } from '../queries/memo.queries';
import { toMemoPreview } from '../utils/memo.view-model';

const LOADING_ITEMS_PER_COLUMN = 2;
const MAX_ENTERING_STAGGER_STEP = 8;
const ENTERING_STAGGER_MS = 40;
const ENTERING_DURATION_MS = 400;
const LAYOUT_SPRING_DAMPING = 18;
const LAYOUT_SPRING_STIFFNESS = 120;
/** 두 열을 번갈아 채우므로 한 행은 항목 두 개만큼 늦게 나타난다 */
const ENTERING_ROW_STAGGER_STEP = 2;
const TITLE_LINE_COUNT_WITH_BODY = 2;
const TITLE_LINE_COUNT_ALONE = 4;

/** 펼친 화면에서는 목록 pane이 좁아 한 열로 보여준다. */
function getColumnCount(paneSizeClass: WindowSizeClass) {
  return match(paneSizeClass)
    .with('compact', () => 2)
    .with(P.union('medium', 'expanded'), () => 1)
    .exhaustive();
}

export function MemoList() {
  const { t } = useTranslation('memo');
  const {
    data: memos,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(useGetMemosInfiniteQueryOptions());
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const [voiceNotes] = useVoiceNotes(me.id);
  const hasVoiceNotes = voiceNotes.length > 0;
  const paneSizeClass = usePaneSizeClass();
  // 칸마다 route 훅을 부르면 URL이 바뀔 때마다 메모 수만큼 params를 다시 파싱한다. 목록이 한 번 읽어 넘긴다
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemoId();

  if (memos.length === 0) {
    return hasVoiceNotes ? null : <MemoList.Empty />;
  }

  // 메모가 하나면 옆 칸이 비지 않게 한 열로 보여 준다
  const columnCount = Math.min(getColumnCount(paneSizeClass), memos.length);

  return (
    <VStack gap={20}>
      <VStack gap={8}>
        {hasVoiceNotes && (
          <Text size="b4" weight="semibold" shade={6}>
            {t('list.savedTitle')}
          </Text>
        )}

        <HStack gap={12} align="start">
          {range(columnCount).map((columnIndex) => (
            <VStack key={columnIndex} flex={1} gap={12}>
              {memos
                .filter((_, memoIndex) => memoIndex % columnCount === columnIndex)
                .map((memo, rowIndex) => (
                  <Animated.View
                    key={memo.id}
                    layout={LinearTransition.springify()
                      .damping(LAYOUT_SPRING_DAMPING)
                      .stiffness(LAYOUT_SPRING_STIFFNESS)}
                    entering={FadeInDown.delay(
                      clamp(
                        rowIndex * ENTERING_ROW_STAGGER_STEP + columnIndex,
                        MAX_ENTERING_STAGGER_STEP,
                      ) * ENTERING_STAGGER_MS,
                    ).duration(ENTERING_DURATION_MS)}
                  >
                    <MemoList.Item
                      memo={memo}
                      isSelected={selectedMemoId === memo.id}
                      onSelect={setSelectedMemoId}
                    />
                  </Animated.View>
                ))}
            </VStack>
          ))}
        </HStack>
      </VStack>

      {hasNextPage && (
        <MemoList.More
          onPress={() => fetchNextPage({ cancelRefetch: false })}
          isLoading={isFetchingNextPage}
          isDisabled={isFetching}
          hasError={isFetchNextPageError}
        />
      )}
    </VStack>
  );
}

interface MemoListItemProps {
  memo: Memo;
  isSelected: boolean;
  onSelect: (memoId: number) => void;
}

MemoList.Item = function Item({ memo, isSelected, onSelect }: MemoListItemProps) {
  const selectMemo = useSingleTap(onSelect);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { title, body } = toMemoPreview(memo);

  return (
    <PressableFeedback onPress={() => selectMemo(memo.id)} className="rounded-2xl">
      <VStack
        gap={8}
        className={cn(
          'rounded-2xl border bg-gray-1 p-4',
          isSelected ? 'border-main' : 'border-transparent',
        )}
      >
        <HStack align="start" gap={8}>
          <Text
            className="flex-1"
            size="b3"
            weight="semibold"
            numberOfLines={body.length > 0 ? TITLE_LINE_COUNT_WITH_BODY : TITLE_LINE_COUNT_ALONE}
            lineBreakStrategyIOS="hangul-word"
          >
            {title}
          </Text>
          {memo.isPinned && <PinFilledIcon width={14} height={14} colorClassName="text-main" />}
        </HStack>
        {body.length > 0 && (
          <Text size="b4" shade={6} numberOfLines={3} lineBreakStrategyIOS="hangul-word">
            {body}
          </Text>
        )}
        <Text size="e1" shade={5}>
          {formatYearAwareDateLabel(memo.createdAt, todayKey, dateFormatContext)}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};

MemoList.Loading = function Loading() {
  const columnCount = getColumnCount(usePaneSizeClass());

  return (
    <HStack gap={12} align="start">
      {range(columnCount).map((column) => (
        <VStack key={column} flex={1} gap={12}>
          {range(LOADING_ITEMS_PER_COLUMN).map((row) => (
            <VStack key={row} gap={8} className="rounded-2xl bg-gray-1 p-4">
              <TextSkeleton size="b3" className="w-full" />
              <TextSkeleton size="b3" className="w-3/4" />
              <TextSkeleton size="e1" className="w-1/2" />
            </VStack>
          ))}
        </VStack>
      ))}
    </HStack>
  );
};

MemoList.Empty = function Empty() {
  const { t } = useTranslation('memo');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const startVoiceNote = useStartVoiceNote();

  return (
    <HStack flex={1} justify="center" align="center">
      <Result
        icon={<MemoIllustration />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
        button={
          <Result.Button onPress={() => startVoiceNote()}>
            {tVoiceNote('start.label')}
          </Result.Button>
        }
      />
    </HStack>
  );
};

MemoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <HStack flex={1} justify="center" align="center">
      <QueryErrorFallback title={t('memo:list.loadFailed')} reset={reset} />
    </HStack>
  );
};

MemoList.More = function More({
  hasError,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { hasError: boolean }) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <VStack align="center" gap={8} pb={12}>
      {hasError && (
        <Text size="b4" shade={6} align="center">
          {t('memo:list.nextPageFailed')}
        </Text>
      )}
      <Button variant="weak" display="inline" {...props}>
        {t(hasError ? 'common:actions.retry' : 'memo:list.loadMore')}
      </Button>
    </VStack>
  );
};
