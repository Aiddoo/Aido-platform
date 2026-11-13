import { useVoiceRecordingRepository } from '@src/bootstrap/providers/di-context';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useView } from '@src/shared/hooks/use-view';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  READABLE_CONTENT_MAX_WIDTH,
  ScrollFade,
  SegmentTabTrigger,
  Text,
  TextSkeleton,
  ViewTabs,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { noop, range } from 'es-toolkit';
import { Stack } from 'expo-router';
import { Skeleton, Tabs } from 'heroui-native';
import { type ComponentProps, type PropsWithChildren, Suspense, useState } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNotePlayback } from '../../hooks/use-voice-note-playback';
import { useVoiceNotePlayer, type VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import { type VoiceNoteTab, voiceNoteTabSchema } from '../../schemas/voice-note-params.schema';
import { formatMediaTime } from '../../utils/media-time.view-model';
import { getDurationBucket } from '../../utils/voice-analytics';
import { createSpeechLevels, getFlagBarIndexes } from '../../utils/waveform.geometry';
import { PlanReview } from '../plan-review/plan-review';
import { SentenceCaptionList } from '../sentence-caption-list';
import { VoiceNoteToolbar } from '../voice-note-toolbar';
import { KeyPointList } from './key-point-list';
import { VoiceNotePlanTodos } from './voice-note-plan-todos';
import { VoiceNotePlayerBar } from './voice-note-player-bar';

const PLAN_TODOS_CLASS_NAME = 'flex-1 pb-3';
const LOADING_SUMMARY_LINE_COUNT = 3;

interface VoiceNoteResultProps {
  onMemoChanged: () => void;
}

export function VoiceNoteResult({ onMemoChanged }: VoiceNoteResultProps) {
  const [tab, setTab] = useView('tab', voiceNoteTabSchema);
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const isCompact = useWindowSizeClass() === 'compact';
  const { player, canPlay } = useVoiceNoteResultPlayer();
  // 결과 화면에서는 문장이 바뀌지 않아 한 번만 만든다. 자동 저장으로 노트가 바뀔 때마다 다시 계산하지 않는다
  const [levels] = useState(() => createSpeechLevels(note.sentences, note.durationMs));
  const selectedTab = !isCompact && tab === 'todos' ? 'summary' : tab;

  return (
    <VStack flex={1} gap={12}>
      <Stack.Screen options={{ title: '' }} />
      <VoiceNoteToolbar onMemoChanged={onMemoChanged} />
      <VoiceNoteResult.Title />
      <VoiceNotePlayerBar
        player={player}
        levels={levels}
        flagIndexes={getFlagBarIndexes(note.sentences)}
        isRecordingAvailable={canPlay}
      />
      <HStack flex={1} gap={20}>
        <VStack flex={1} gap={12}>
          <VoiceNoteResult.TabList value={selectedTab} onValueChange={setTab} />
          <Box flex={1}>
            {match(selectedTab)
              .with('summary', () => (
                <VoiceNoteResult.Summary>
                  <VoiceNoteResult.KeyPoints player={player} canPlay={canPlay} />
                </VoiceNoteResult.Summary>
              ))
              .with('todos', () => (
                <QueryErrorBoundary>
                  <Suspense fallback={<PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />}>
                    <VoiceNotePlanTodos
                      className={PLAN_TODOS_CLASS_NAME}
                      onMemoChanged={onMemoChanged}
                    />
                  </Suspense>
                </QueryErrorBoundary>
              ))
              .with('transcript', () => (
                <VoiceNoteResult.Transcript player={player} canPlay={canPlay} />
              ))
              .exhaustive()}
          </Box>
        </VStack>
        {!isCompact && (
          <Box flex={1} style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}>
            <QueryErrorBoundary>
              <Suspense fallback={<PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />}>
                <VoiceNotePlanTodos
                  className={PLAN_TODOS_CLASS_NAME}
                  onMemoChanged={onMemoChanged}
                />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        )}
      </HStack>
    </VStack>
  );
}

VoiceNoteResult.Title = function Title() {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const markCount = VoiceNotePolicy.getMarkCount(note);
  const date = formatYearAwareDateLabel(note.createdAt, todayKey, dateFormatContext);
  const duration = formatMediaTime(note.durationMs);

  return (
    <VStack gap={4}>
      <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
        {VoiceNotePolicy.findDigestTitle(note) ?? t('result.defaultTitle')}
      </Text>
      <Text size="e1" shade={6} className="tabular-nums">
        {markCount > 0
          ? t('result.metaMarks', { date, duration, amount: markCount })
          : t('result.meta', { date, duration })}
      </Text>
    </VStack>
  );
};

interface VoiceNoteResultTabListProps extends Omit<
  ComponentProps<typeof Tabs>,
  'value' | 'onValueChange' | 'children'
> {
  value: VoiceNoteTab;
  onValueChange: (tab: VoiceNoteTab) => void;
}

VoiceNoteResult.TabList = function TabList({
  value,
  onValueChange,
  ...tabsProps
}: VoiceNoteResultTabListProps) {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const isCompact = useWindowSizeClass() === 'compact';
  const todoCount = VoiceNotePolicy.findTodoCount(note);

  return (
    <ViewTabs
      {...tabsProps}
      schema={voiceNoteTabSchema}
      value={value}
      onValueChange={onValueChange}
    >
      <Tabs.List>
        <Tabs.Indicator />
        <SegmentTabTrigger
          value="summary"
          testID="voice-note-tab-summary"
          size="b2"
          numberOfLines={1}
        >
          {t('result.tabs.summary')}
        </SegmentTabTrigger>
        {isCompact && (
          <SegmentTabTrigger
            value="todos"
            testID="voice-note-tab-todos"
            size="b2"
            numberOfLines={1}
          >
            {todoCount == null
              ? t('result.tabs.todosUncounted')
              : t('result.tabs.todos', { amount: todoCount })}
          </SegmentTabTrigger>
        )}
        <SegmentTabTrigger
          value="transcript"
          testID="voice-note-tab-transcript"
          size="b2"
          numberOfLines={1}
        >
          {t('result.tabs.transcript')}
        </SegmentTabTrigger>
      </Tabs.List>
    </ViewTabs>
  );
};

interface VoiceNoteResultPlaybackProps {
  player: VoiceNotePlayer;
  canPlay: boolean;
}

VoiceNoteResult.Summary = function Summary({ children }: PropsWithChildren) {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <ScrollFade surface="screen" className="flex-1">
      <ScrollView contentContainerClassName="gap-4 pb-6" showsVerticalScrollIndicator={false}>
        <WordWrapText size="b2">{note.digest?.summary ?? ''}</WordWrapText>
        {/* 넓은 화면은 할 일 칸이 늘 보여 거기서 알린다 */}
        {isCompact && VoiceNotePolicy.hasEmptyPlan(note) && (
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word" testID="voice-note-no-todos">
            {t('result.noTodos')}
          </Text>
        )}
        <VStack gap={4}>
          <Text size="b4" weight="semibold" shade={6}>
            {t('keyPoints.title')}
          </Text>
          {children}
        </VStack>
      </ScrollView>
    </ScrollFade>
  );
};

VoiceNoteResult.KeyPoints = function KeyPoints({ player, canPlay }: VoiceNoteResultPlaybackProps) {
  const { trackEvent } = useTrack();
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const activeKeyPointId = useVoiceNotePlayback(player, ({ isPlaying, positionMs }) =>
    isPlaying ? VoiceNotePolicy.findKeyPointAt(note, positionMs)?.id : undefined,
  );

  return (
    <KeyPointList
      hasTimeCoachmark
      keyPoints={note.digest?.keyPoints ?? []}
      activeKeyPointId={activeKeyPointId}
      onPressKeyPoint={
        canPlay
          ? ({ startMs }) => {
              if (startMs == null) {
                return;
              }
              trackEvent('voice_note_key_point_played', {
                position_bucket: getDurationBucket(startMs),
              });
              player.playFrom(startMs).catch(noop);
            }
          : undefined
      }
    />
  );
};

VoiceNoteResult.Transcript = function Transcript({
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const activeSentenceIndex = useVoiceNotePlayback(player, ({ isPlaying, positionMs }) =>
    isPlaying ? VoiceNotePolicy.getSentenceIndexAt(note, positionMs) : undefined,
  );

  return (
    <SentenceCaptionList
      sentences={note.sentences}
      activeSentenceIndex={activeSentenceIndex}
      onPressSentence={canPlay ? ({ startMs }) => player.playFrom(startMs).catch(noop) : undefined}
      className="min-h-24 flex-1"
    />
  );
};

/** 결과와 같은 자리(제목·재생 줄·탭·요약, 넓은 화면은 할 일 칸)를 잡는다 */
VoiceNoteResult.Loading = function Loading() {
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <VStack flex={1} gap={12} testID="voice-note-screen-loading">
      <VStack className="gap-1">
        <TextSkeleton size="t3" className="w-2/3" />
        <TextSkeleton size="e1" className="w-1/2" />
      </VStack>
      <HStack className="items-center rounded-2xl bg-gray-1 px-3 py-3">
        <Skeleton className="size-9 rounded-full" />
      </HStack>
      <HStack className="gap-5" flex={1}>
        <VStack flex={1} gap={12}>
          <Tabs value="summary" onValueChange={noop} accessibilityState={{ busy: true }}>
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value="summary">
                <TextSkeleton size="b2" className="w-10" />
              </Tabs.Trigger>
              {isCompact && (
                <Tabs.Trigger value="todos">
                  <TextSkeleton size="b2" className="w-14" />
                </Tabs.Trigger>
              )}
              <Tabs.Trigger value="transcript">
                <TextSkeleton size="b2" className="w-10" />
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
          <VStack gap={4}>
            {range(LOADING_SUMMARY_LINE_COUNT).map((index) => (
              <TextSkeleton key={index} size="b2" className="w-full" />
            ))}
          </VStack>
        </VStack>
        {!isCompact && (
          <Box flex={1} style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}>
            <PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />
          </Box>
        )}
      </HStack>
    </VStack>
  );
};

VoiceNoteResult.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

function useVoiceNoteResultPlayer() {
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  const recordingRepository = useVoiceRecordingRepository();
  const [parts] = useState(() =>
    note.recordings.flatMap(({ fileName, startMs }) => {
      const uri = recordingRepository.findUri(accountId, fileName);
      return uri == null ? [] : [{ uri, startMs }];
    }),
  );
  const player = useVoiceNotePlayer({ parts, durationMs: note.durationMs });

  useOnScreenBlur(() => {
    if (player.getPlayback().isPlaying) {
      player.togglePlay().catch(noop);
    }
  });

  return { player, canPlay: parts.length > 0 };
}
