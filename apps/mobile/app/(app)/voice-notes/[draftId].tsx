import Check from '@expo/material-symbols/check.xml';
import Delete from '@expo/material-symbols/delete.xml';
import NoteAdd from '@expo/material-symbols/note_add.xml';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { DigestProgress } from '@src/features/voice/components/note/digest-progress';
import { DigestScanPreview } from '@src/features/voice/components/note/digest-scan-preview';
import { KeyPointList } from '@src/features/voice/components/note/key-point-list';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteDigestButton } from '@src/features/voice/components/note/voice-note-digest-button';
import { VoiceNotePlanTodos } from '@src/features/voice/components/note/voice-note-plan-todos';
import { VoiceNotePlayerBar } from '@src/features/voice/components/note/voice-note-player-bar';
import { VoiceNoteScreenLoading } from '@src/features/voice/components/note/voice-note-screen-loading';
import { PlanReview } from '@src/features/voice/components/plan/plan-review';
import { type VoiceNote, VoiceNotePolicy } from '@src/features/voice/domains/voice-note.model';
import { canRetryPlanFailure } from '@src/features/voice/domains/voice.error';
import { useCurrentVoiceNote } from '@src/features/voice/hooks/use-current-voice-note';
import {
  useVoiceNoteDigest,
  type VoiceNoteDigestFailure,
} from '@src/features/voice/hooks/use-voice-note-digest';
import {
  useVoiceNoteTab,
  type VoiceNoteTab,
  voiceNoteParamsSchema,
  voiceNoteTabSchema,
} from '@src/features/voice/hooks/use-voice-note-params';
import {
  useVoiceNotePlayback,
  useVoiceNotePlayer,
  type VoiceNotePlayer,
} from '@src/features/voice/hooks/use-voice-note-player';
import { useVoiceNoteSaveMemo } from '@src/features/voice/hooks/use-voice-note-save-memo';
import { getDurationBucket } from '@src/features/voice/utils/analytics/duration-bucket';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import {
  createSpeechLevels,
  getFlagBarIndexes,
} from '@src/features/voice/utils/view-models/waveform.view-model';
import { useTrack } from '@src/shared/analytics';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorBoundary,
  READABLE_CONTENT_MAX_WIDTH,
  Result,
  ScreenScrollShadow,
  STACK_MORE_ICON,
  StyledSafeAreaView,
  Text,
  useConfirmDialog,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { noop } from 'es-toolkit';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { type ComponentProps, Suspense, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

/** 정리 중 미리보기에 보여 줄 앞부분 문장 수. 전체를 그릴 이유가 없다 */
const SCAN_PREVIEW_SENTENCES = 12;

const PLAN_TODOS_CLASS_NAME = 'flex-1 pb-3';

/** 네이티브 헤더 버튼 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
const VOICE_NOTE_TOOLBAR_ICON = {
  saveMemo: Platform.OS === 'ios' ? 'note.text.badge.plus' : NoteAdd,
  memoSaved: Platform.OS === 'ios' ? 'checkmark' : Check,
  delete: Platform.OS === 'ios' ? 'trash' : Delete,
} as const;

const closeScreen = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/memo');
  }
};

function VoiceNoteScreen() {
  const { t } = useTranslation('voiceNote');
  const { note } = useCurrentVoiceNote();

  if (note == null) {
    return (
      <VStack flex={1} className="px-4 pt-2">
        <Stack.Screen options={{ title: '' }} />
        <Result title={t('result.notFound')} testID="voice-note-not-found" />
      </VStack>
    );
  }

  return note.digest == null ? <VoiceNoteDigest note={note} /> : <VoiceNoteResult note={note} />;
}

interface VoiceNoteDigestProps {
  note: VoiceNote;
}

/** 메모로 저장은 정리한 뒤에만 보인다. 저장했으면 다시 저장하지 않게 체크로 바뀐다 */
function VoiceNoteToolbar({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const storage = useVoiceNoteStorageService();
  const confirmDialog = useConfirmDialog();
  const { saveMemo, canSaveMemo, isMemoSaved, isSavingMemo } = useVoiceNoteSaveMemo(note);
  const saveMemoLabel = isMemoSaved ? t('result.memoSaved') : t('result.saveMemo');

  const handleDelete = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('result.deleteTitle'),
      description: t('result.deleteDescription'),
      confirmLabel: t('result.deleteConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('result.deleteCancel'),
    });
    if (isConfirmed) {
      storage.discard(accountId, draftId);
      closeScreen();
    }
  };

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        hidden={!isMemoSaved && !canSaveMemo}
        icon={isMemoSaved ? VOICE_NOTE_TOOLBAR_ICON.memoSaved : VOICE_NOTE_TOOLBAR_ICON.saveMemo}
        accessibilityLabel={saveMemoLabel}
        disabled={isMemoSaved || isSavingMemo}
        onPress={saveMemo}
      >
        {saveMemoLabel}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('result.more')}>
        <Stack.Toolbar.MenuAction
          icon={VOICE_NOTE_TOOLBAR_ICON.delete}
          destructive
          onPress={handleDelete}
        >
          {t('result.delete')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

/** 정리 전: 들은 글자를 보여 주고, 누르면 정리한다. 실패해도 글자는 그대로 있고 다시 정리할 수 있다 */
function VoiceNoteDigest({ note }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { digest, isPending, failure } = useVoiceNoteDigest({ accountId, draftId });

  if (isPending) {
    return <VoiceNoteDigest.Progress note={note} />;
  }

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen options={{ title: t('digest.readyTitle') }} />
      <VoiceNoteToolbar note={note} />
      <SentenceCaptionList sentences={note.sentences} className="min-h-24 flex-1" />
      {failure != null && <VoiceNoteDigest.Failure failure={failure} />}
      {(failure == null || canRetryPlanFailure(failure.cause)) && (
        <VoiceNoteDigestButton
          label={failure == null ? t('digest.action') : t('digest.retry')}
          isDisabled={!VoiceNotePolicy.canDigest(note)}
          onPress={() => digest()}
        />
      )}
    </VStack>
  );
}

VoiceNoteDigest.Progress = function Progress({ note }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack flex={1} gap={16} className="px-4 pb-3 pt-2" testID="voice-note-digesting">
      <Stack.Screen options={{ title: t('digest.title') }} />
      <DigestScanPreview
        paragraphs={note.sentences.slice(0, SCAN_PREVIEW_SENTENCES).map(({ text }) => text)}
        className="max-h-[50%]"
      />
      <DigestProgress
        characterCount={VoiceNotePolicy.getCharacterCount(note)}
        markCount={VoiceNotePolicy.getMarkCount(note)}
      />
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('digest.hint')}
      </Text>
    </VStack>
  );
};

VoiceNoteDigest.Failure = function Failure({ failure }: { failure: VoiceNoteDigestFailure }) {
  const { t } = useTranslation(['voiceNote', 'voicePlan']);

  return (
    <VStack gap={4} className="rounded-2xl bg-gray-1 px-4 py-3" testID="voice-note-digest-failure">
      <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
        {t(`voicePlan:failure.${failure.cause}.title`)}
      </Text>
      <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
        {failure.cause === 'too-long' ? `${t('voiceNote:digest.tooLong')} ` : ''}
        {failure.cause === 'network' ? `${t('voiceNote:digest.offline')} ` : ''}
        {t('voiceNote:digest.kept')}
        {failure.isNotCharged ? ` ${t('voiceNote:digest.notCharged')}` : ''}
      </Text>
    </VStack>
  );
};

/** 정리 뒤: 제목·재생 줄 아래로 요약·할 일·전문을 고른다. 넓은 화면은 할 일 칸이 옆에 늘 보인다 */
function VoiceNoteResult({ note }: { note: VoiceNote }) {
  const [tab, setTab] = useVoiceNoteTab();
  const isCompact = useWindowSizeClass() === 'compact';
  const { player, canPlay } = useVoiceNoteResultPlayer(note);
  // 결과 화면에서는 문장이 바뀌지 않아 한 번만 만든다. 자동 저장으로 노트가 바뀔 때마다 다시 계산하지 않는다
  const [levels] = useState(() => createSpeechLevels(note.sentences, note.durationMs));
  const selectedTab = !isCompact && tab === 'todos' ? 'summary' : tab;

  return (
    <VStack flex={1} gap={12} className="px-4 pt-2">
      <Stack.Screen options={{ title: '' }} />
      <VoiceNoteToolbar note={note} />
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
                <VoiceNoteResult.Summary note={note} player={player} canPlay={canPlay} />
              ))
              .with('todos', () => <VoiceNoteResult.Todos note={note} />)
              .with('transcript', () => (
                <VoiceNoteResult.Transcript note={note} player={player} canPlay={canPlay} />
              ))
              .exhaustive()}
          </Animated.View>
        </VStack>
        {!isCompact && (
          <Box flex={1} style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}>
            <VoiceNoteResult.Todos note={note} />
          </Box>
        )}
      </HStack>
    </VStack>
  );
}

/** 기기에 남은 녹음 조각으로 만든 플레이어. 화면을 벗어나면 재생을 멈춘다 */
function useVoiceNoteResultPlayer(note: VoiceNote) {
  const { accountId } = useCurrentVoiceNote();
  const { recordings } = useVoiceNoteStorageService();
  const [parts] = useState(() =>
    note.recordings.flatMap(({ fileName, startMs }) => {
      const uri = recordings.findUri(accountId, fileName);
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
  const markCount = VoiceNotePolicy.getMarkCount(note);
  const date = formatDateLabel(note.createdAt, 'monthDay', dateFormatContext);
  const duration = formatMediaTime(note.durationMs);

  return (
    <VStack gap={4}>
      <Text size="t3" weight="bold" lineBreakStrategyIOS="hangul-word">
        {VoiceNotePolicy.getDigestTitle(note) ?? t('result.defaultTitle')}
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

  return (
    <Tabs
      {...tabsProps}
      value={value}
      onValueChange={(next) => {
        const parsed = voiceNoteTabSchema.safeParse(next);
        if (parsed.success) {
          onValueChange(parsed.data);
        }
      }}
    >
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="summary" testID="voice-note-tab-summary">
          <Tabs.Label numberOfLines={1}>{t('result.tabs.summary')}</Tabs.Label>
        </Tabs.Trigger>
        {isCompact && (
          <Tabs.Trigger value="todos" testID="voice-note-tab-todos">
            <Tabs.Label numberOfLines={1}>
              {t('result.tabs.todos', { amount: VoiceNotePolicy.getPlannedTodoCount(note) })}
            </Tabs.Label>
          </Tabs.Trigger>
        )}
        <Tabs.Trigger value="transcript" testID="voice-note-tab-transcript">
          <Tabs.Label numberOfLines={1}>{t('result.tabs.transcript')}</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
};

VoiceNoteResult.Todos = function Todos({ note }: { note: VoiceNote }) {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={<PlanReview.Loading className={PLAN_TODOS_CLASS_NAME} />}>
        <VoiceNotePlanTodos note={note} className={PLAN_TODOS_CLASS_NAME} />
      </Suspense>
    </QueryErrorBoundary>
  );
};

interface VoiceNoteResultPlaybackProps {
  note: VoiceNote;
  player: VoiceNotePlayer;
  canPlay: boolean;
}

VoiceNoteResult.Summary = function Summary({
  note,
  player,
  canPlay,
}: VoiceNoteResultPlaybackProps) {
  const { t } = useTranslation('voiceNote');
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <ScreenScrollShadow className="flex-1">
      <ScrollView contentContainerClassName="gap-4 pb-6" showsVerticalScrollIndicator={false}>
        <WordWrapText size="b2">{note.digest?.summary ?? ''}</WordWrapText>
        {/* 넓은 화면은 할 일 칸이 늘 보여 거기서 알린다 */}
        {isCompact && VoiceNotePolicy.hasNoPlannedTodos(note) && (
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word" testID="voice-note-no-todos">
            {t('result.noTodos')}
          </Text>
        )}
        <VStack gap={4}>
          <Text size="b4" weight="semibold" shade={6}>
            {t('keyPoints.title')}
          </Text>
          <VoiceNoteResult.KeyPoints note={note} player={player} canPlay={canPlay} />
        </VStack>
      </ScrollView>
    </ScreenScrollShadow>
  );
};

/** 재생 중인 포인트가 바뀔 때만 다시 그린다 */
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

/** 재생 중인 문장이 바뀔 때만 다시 그린다 */
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

export default function VoiceNoteRoute() {
  const params = voiceNoteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.draftId]}>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteScreen key={params.data.draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
