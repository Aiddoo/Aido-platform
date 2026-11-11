import { useVoiceRecordingRepository } from '@src/bootstrap/providers/di-context';
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
  READABLE_CONTENT_MAX_WIDTH,
  ScrollFade,
  SegmentTabTrigger,
  Text,
  ViewTabs,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { Stack } from 'expo-router';
import { Tabs } from 'heroui-native';
import { type ComponentProps, type ReactNode, Suspense, useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { VoiceNotePolicy, type VoiceNote } from '../../domains/voice-note.model';
import { useVoiceNoteRoute } from '../../hooks/use-current-voice-note';
import {
  useVoiceNotePlayback,
  useVoiceNotePlayer,
  type VoiceNotePlayer,
} from '../../hooks/use-voice-note-player';
import { type VoiceNoteTab, voiceNoteTabSchema } from '../../schemas/voice-note-params.schema';
import { formatMediaTime } from '../../utils/format-media-time';
import { getDurationBucket } from '../../utils/voice-analytics';
import { createSpeechLevels, getFlagBarIndexes } from '../../utils/waveform.geometry';
import { PlanReview } from '../plan/plan-review';
import { KeyPointList } from './key-point-list';
import { SentenceCaptionList } from './sentence-caption-list';
import { VoiceNotePlanTodos } from './voice-note-plan-todos';
import { VoiceNotePlayerBar } from './voice-note-player-bar';
import { VoiceNoteToolbar } from './voice-note-toolbar';

const PLAN_TODOS_CLASS_NAME = 'flex-1 pb-3';

interface VoiceNoteResultProps {
  note: VoiceNote;
  onMemoChanged: () => void;
}

export function VoiceNoteResult({ note, onMemoChanged }: VoiceNoteResultProps) {
  const [tab, setTab] = useView('tab', voiceNoteTabSchema);
  const isCompact = useWindowSizeClass() === 'compact';
  const { player, canPlay } = useVoiceNoteResultPlayer(note);
  // 결과 화면에서는 문장이 바뀌지 않아 한 번만 만든다. 자동 저장으로 노트가 바뀔 때마다 다시 계산하지 않는다
  const [levels] = useState(() => createSpeechLevels(note.sentences, note.durationMs));
  const selectedTab = !isCompact && tab === 'todos' ? 'summary' : tab;

  return (
    <VStack flex={1} gap={12}>
      <Stack.Screen options={{ title: '' }} />
      <VoiceNoteToolbar note={note} onMemoChanged={onMemoChanged} />
      <VoiceNoteResult.Title note={note} />
      <VoiceNotePlayerBar
        player={player}
        levels={levels}
        flagIndexes={getFlagBarIndexes(note.sentences)}
        isRecordingAvailable={canPlay}
      />
      <HStack flex={1} gap={20}>
        <VStack flex={1} gap={12}>
          <VoiceNoteResult.TabList note={note} value={selectedTab} onValueChange={setTab} />
          <Animated.View entering={FadeIn.duration(200)} key={selectedTab} style={{ flex: 1 }}>
            {match(selectedTab)
              .with('summary', () => (
                <VoiceNoteResult.Summary note={note}>
                  <VoiceNoteResult.KeyPoints note={note} player={player} canPlay={canPlay} />
                </VoiceNoteResult.Summary>
              ))
              .with('todos', () => (
                <QueryErrorBoundary>
                  <Suspense fallback={<PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />}>
                    <VoiceNotePlanTodos
                      note={note}
                      className={PLAN_TODOS_CLASS_NAME}
                      onMemoChanged={onMemoChanged}
                    />
                  </Suspense>
                </QueryErrorBoundary>
              ))
              .with('transcript', () => (
                <VoiceNoteResult.Transcript note={note} player={player} canPlay={canPlay} />
              ))
              .exhaustive()}
          </Animated.View>
        </VStack>
        {!isCompact && (
          <Box flex={1} style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}>
            <QueryErrorBoundary>
              <Suspense fallback={<PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />}>
                <VoiceNotePlanTodos
                  note={note}
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

function useVoiceNoteResultPlayer(note: VoiceNote) {
  const [{ accountId }] = useVoiceNoteRoute();
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

VoiceNoteResult.Title = function Title({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
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
  note: VoiceNote;
  value: VoiceNoteTab;
  onValueChange: (tab: VoiceNoteTab) => void;
}

VoiceNoteResult.TabList = function TabList({
  note,
  value,
  onValueChange,
  ...tabsProps
}: VoiceNoteResultTabListProps) {
  const { t } = useTranslation('voiceNote');
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
  note: VoiceNote;
  player: VoiceNotePlayer;
  canPlay: boolean;
}

interface VoiceNoteResultSummaryProps {
  note: VoiceNote;
  children: ReactNode;
}

VoiceNoteResult.Summary = function Summary({ note, children }: VoiceNoteResultSummaryProps) {
  const { t } = useTranslation('voiceNote');
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

VoiceNoteResult.KeyPoints = function KeyPoints({
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const { trackEvent } = useTrack();
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
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const activeSentenceIndex = useVoiceNotePlayback(player, ({ isPlaying, positionMs }) =>
    isPlaying ? VoiceNotePolicy.findSentenceIndexAt(note, positionMs) : undefined,
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
