import { useVoiceRecordingRepository } from '@src/bootstrap/providers/di-context';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useView } from '@src/shared/hooks/use-view';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FlagIcon,
  HStack,
  PlayIcon,
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
import { cn } from '@src/shared/utils/cn';
import { noop, range } from 'es-toolkit';
import { Stack } from 'expo-router';
import { PressableFeedback, Skeleton, Tabs } from 'heroui-native';
import {
  type ComponentProps,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import type { VoiceNoteKeyPoint } from '../../domains/voice-note-digest.model';
import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNotePlayback } from '../../hooks/use-voice-note-playback';
import { useVoiceNotePlayer, type VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import { type VoiceNoteTab, voiceNoteTabSchema } from '../../schemas/voice-note-params.schema';
import { formatMediaTime } from '../../utils/media-time.view-model';
import { getDurationBucket } from '../../utils/voice-analytics';
import { createSpeechLevels, getFlagBarIndexes } from '../../utils/waveform.geometry';
import { SentenceCaptionList } from '../sentence-caption-list';
import { VoiceNoteToolbar } from '../voice-note-toolbar';
import { VoiceNotePlayerBar } from './voice-note-player-bar';

const LOADING_SUMMARY_LINE_COUNT = 3;
/** 위로 뜨는 시간 칩 안내의 높이. 이만큼 비워 요약과 "핵심 포인트" 제목을 가리지 않는다 */
const KEY_POINT_HINT_HEIGHT = 116;

interface VoiceNoteResultProps {
  onMemoChanged: () => void;
  /** 할 일 카드 칸. 좁은 화면은 할 일 탭에, 넓은 화면은 오른쪽 칸에 둔다. 조회 경계는 화면이 감싸 넘긴다 */
  planTodos: ReactNode;
}

export function VoiceNoteResult({ onMemoChanged, planTodos }: VoiceNoteResultProps) {
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
              .with('todos', () => planTodos)
              .with('transcript', () => (
                <VoiceNoteResult.Transcript player={player} canPlay={canPlay} />
              ))
              .exhaustive()}
          </Box>
        </VStack>
        {!isCompact && (
          <Box flex={1} style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}>
            {planTodos}
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
              // 위치 이동 실패는 플레이어가 로그로 남긴다
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
      // 위치 이동 실패는 플레이어가 로그로 남긴다
      onPressSentence={canPlay ? ({ startMs }) => player.playFrom(startMs).catch(noop) : undefined}
      className="min-h-24 flex-1"
    />
  );
};

/** 결과와 같은 자리(제목·재생 줄·탭·요약, 넓은 화면은 할 일 칸)를 잡는다 */
VoiceNoteResult.Loading = function Loading({ planTodos }: Pick<VoiceNoteResultProps, 'planTodos'>) {
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
            {planTodos}
          </Box>
        )}
      </HStack>
    </VStack>
  );
};

VoiceNoteResult.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

interface KeyPointListProps {
  keyPoints: readonly VoiceNoteKeyPoint[];
  activeKeyPointId?: string;
  onPressKeyPoint?: (keyPoint: VoiceNoteKeyPoint) => void;
  hasTimeCoachmark?: boolean;
}

function KeyPointList({
  keyPoints,
  activeKeyPointId,
  onPressKeyPoint,
  hasTimeCoachmark = false,
}: KeyPointListProps) {
  // 들을 녹음이 없으면 안내가 사실이 아니라 띄우지 않고 소비하지도 않는다
  const coachmarkKeyPointId =
    hasTimeCoachmark && onPressKeyPoint != null
      ? keyPoints.find(({ startMs }) => startMs != null)?.id
      : undefined;

  return (
    <VStack gap={4}>
      {coachmarkKeyPointId != null && <KeyPointHintSpace />}
      {keyPoints.map((keyPoint, index) => (
        <KeyPointList.Item
          key={keyPoint.id}
          keyPoint={keyPoint}
          isSameTimeAsPrevious={hasSameTime(keyPoint, keyPoints[index - 1])}
          isActive={keyPoint.id === activeKeyPointId}
          isPlayable={onPressKeyPoint != null}
          hasTimeCoachmark={keyPoint.id === coachmarkKeyPointId}
          onPress={() => onPressKeyPoint?.(keyPoint)}
        />
      ))}
    </VStack>
  );
}

interface KeyPointItemProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel'
> {
  keyPoint: VoiceNoteKeyPoint;
  /** 칩을 숨기되 글자 시작선이 위 포인트와 맞게 자리는 남긴다. 눌러서 재생하는 건 그대로다 */
  isSameTimeAsPrevious: boolean;
  isActive: boolean;
  isPlayable: boolean;
  hasTimeCoachmark: boolean;
}

KeyPointList.Item = function Item({
  keyPoint,
  isSameTimeAsPrevious,
  isActive,
  isPlayable,
  hasTimeCoachmark,
  className,
  ...pressableProps
}: KeyPointItemProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const time = keyPoint.startMs == null ? null : formatMediaTime(keyPoint.startMs);
  const canPlay = isPlayable && time != null;
  const timeChip =
    time == null ? null : (
      <Text
        size="e1"
        weight="bold"
        tone="brand"
        accessibilityElementsHidden={isSameTimeAsPrevious}
        importantForAccessibility={isSameTimeAsPrevious ? 'no-hide-descendants' : 'auto'}
        className={cn(
          'rounded-full bg-main/10 px-2 py-1 tabular-nums',
          isSameTimeAsPrevious && 'opacity-0',
        )}
      >
        {time}
      </Text>
    );

  return (
    <PressableFeedback
      accessibilityRole={canPlay ? 'button' : undefined}
      accessibilityLabel={canPlay ? t('keyPoints.playFrom', { time }) : undefined}
      accessibilityState={{ selected: isActive }}
      isDisabled={!canPlay}
      className={cn('rounded-xl p-3', isActive && 'bg-main/10', className)}
      {...pressableProps}
    >
      <HStack gap={12} className="items-start">
        {hasTimeCoachmark && timeChip != null ? (
          <KeyPointTimeCoachmark>{timeChip}</KeyPointTimeCoachmark>
        ) : (
          timeChip
        )}
        <WordWrapText size="b3" className="flex-1">
          {keyPoint.text}
        </WordWrapText>
        {keyPoint.isBookmarked && (
          <FlagIcon
            colorClassName="text-main"
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            accessibilityLabel={t('keyPoints.marked')}
          />
        )}
      </HStack>
    </PressableFeedback>
  );
};

function KeyPointHintSpace() {
  const fontScaledSize = useFontScaledSize();
  const [isHintPending] = useMyPendingCoachmark('voice-key-point');

  return isHintPending && <Box style={{ height: fontScaledSize(KEY_POINT_HINT_HEIGHT) }} />;
}

/** 칩이 터치를 받으면 포인트 재생이 막혀 안내는 자리만 재고 터치는 행으로 넘긴다 */
function KeyPointTimeCoachmark({ children }: { children: ReactElement }) {
  const { t } = useTranslation('voiceNote');

  return (
    <Box pointerEvents="none">
      <CoachmarkPopover
        kind="voice-key-point"
        title={t('coach.keyPoint.title')}
        description={t('coach.keyPoint.description')}
        Icon={PlayIcon}
        // 아래로 띄우면 다음 포인트를 가린다. 위쪽 자리가 모자라면 말풍선이 알아서 뒤집는다
        placement="top"
        align="start"
        avoidCollisions
      >
        {children}
      </CoachmarkPopover>
    </Box>
  );
}

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
      // 화면을 떠나며 멈추는 일이라 실패해도 알릴 곳이 없다. 위치 이동 실패는 플레이어가 로그로 남긴다
      player.togglePlay().catch(noop);
    }
  });

  return { player, canPlay: parts.length > 0 };
}

/** 한 문장에서 포인트가 여러 개 나오면 시각이 같다. 초 단위로 같게 보이면 같은 칩이 줄줄이 서지 않게 비교한다 */
function hasSameTime(keyPoint: VoiceNoteKeyPoint, previous: VoiceNoteKeyPoint | undefined) {
  return (
    keyPoint.startMs != null &&
    previous?.startMs != null &&
    formatMediaTime(keyPoint.startMs) === formatMediaTime(previous.startMs)
  );
}
