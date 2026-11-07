import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { RecordingTimer } from '@src/features/voice/components/note/recording-timer';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteDigest } from '@src/features/voice/components/note/voice-note-digest';
import { VoiceNoteRecordFooter } from '@src/features/voice/components/note/voice-note-record-footer';
import { VoiceNoteRecordLanguageToggle } from '@src/features/voice/components/note/voice-note-record-language-toggle';
import { RecognizerWaveform } from '@src/features/voice/components/note/waveform-timeline';
import { useCaptureElapsedMs } from '@src/features/voice/hooks/use-capture-elapsed-ms';
import { useReadSpeechContext } from '@src/features/voice/hooks/use-read-speech-context';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useVoiceNoteRecordExit } from '@src/features/voice/hooks/use-voice-note-record-exit';
import { useVoiceNoteRecordLimit } from '@src/features/voice/hooks/use-voice-note-record-limit';
import { useVoiceNoteRecording } from '@src/features/voice/hooks/use-voice-note-recording';
import type { VoiceCaptureState } from '@src/features/voice/schemas/voice-capture.schema';
import { voiceNoteRecordParamsSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { getRecordingRingLayout } from '@src/features/voice/utils/recording-timer.geometry';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useKeepScreenAwake } from '@src/shared/infra/keep-awake/use-keep-screen-awake';
import {
  HStack,
  QueryErrorBoundary,
  STACK_CLOSE_ICON,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

const MARK_HINT_HEIGHT = 124;

function VoiceNoteRecordScreen() {
  const { t } = useTranslation('voiceNote');
  useKeepScreenAwake();
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const { maxSeconds, limitMs, notifyLimit } = useVoiceNoteRecordLimit();
  const getSpeechContext = useReadSpeechContext();
  const [locale] = useRecognitionLanguage();
  const [{ draftId: seedDraftId, entry }] = useRouteParams(voiceNoteRecordParamsSchema);

  const recording = useVoiceNoteRecording({
    accountId: me.id,
    locale,
    seedDraftId,
    entry,
    maxSeconds,
    onLimitReached: () => notifyLimit(recording),
    onFinished: (draftId) =>
      router.replace({ pathname: '/voice-notes/[draftId]', params: { draftId } }),
    onEmpty: () => {
      toast.warning(t('record.empty'));
      router.back();
    },
  });
  useOnScreenBlur(recording.interrupt);
  const { requestClose, requestFinish } = useVoiceNoteRecordExit(recording);
  // 글자를 받을 때마다 recording이 새로 만들어진다. 헤더 옵션이 그때마다 바뀌면 내비게이터까지 다시 그려져 정체성을 고정한다
  const close = useSingleTap(requestClose);
  const changeLocaleRef = useRef(recording.changeLocale);
  useLayoutEffect(() => {
    changeLocaleRef.current = recording.changeLocale;
  });
  const { state } = recording;

  useEffect(() => {
    recording.start({ startLocale: locale, hintWords: getSpeechContext() }).catch(() => {
      toast.error(t('record.failedTitle'));
    });
  }, []);

  const clock = <RecordClock state={state} limitMs={limitMs} />;
  const waveform = (
    <RecognizerWaveform
      level={recording.level}
      isActive={state.status === 'listening'}
      bookmarksMs={recording.bookmarksMs}
      className="self-stretch"
    />
  );
  const captions = (
    <RecordCaptions sentences={recording.sentences} interimText={recording.interimText} />
  );
  const footer = (
    <VoiceNoteRecordFooter
      state={state}
      limitMs={limitMs}
      markCount={recording.markCount}
      onPause={recording.pause}
      onFinish={requestFinish}
      onMark={recording.mark}
      onSummarize={recording.finish}
      onClose={requestClose}
      onResume={recording.resume}
    />
  );

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <VoiceNoteRecordLanguageToggle
              onLocaleChange={(next) => changeLocaleRef.current(next)}
            />
          ),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_CLOSE_ICON}
          accessibilityLabel={t('record.close')}
          onPress={close}
        />
      </Stack.Toolbar>
      {isCompact ? (
        <>
          <VStack align="center" className={cn(state.status === 'paused' && 'opacity-60')}>
            {clock}
          </VStack>
          {waveform}
          {captions}
          {footer}
        </>
      ) : (
        <HStack flex={1} gap={20}>
          <VStack flex={1} gap={12} justify="center" align="center">
            {clock}
            {waveform}
            {footer}
          </VStack>
          <VStack flex={1}>{captions}</VStack>
        </HStack>
      )}
    </VStack>
  );
}

/** 헤더는 레이아웃이 미리 그려 받은 뒤에 밀리지 않는다. 시계와 파형 자리를 받은 뒤와 같은 배치로 잡는다 */
VoiceNoteRecordScreen.Loading = function Loading() {
  const isOnline = useIsOnline();
  const isCompact = useWindowSizeClass() === 'compact';
  const { height: windowHeight } = useWindowDimensions();
  const { size: ringSize } = getRecordingRingLayout(windowHeight);

  const clock = <Skeleton className="rounded-full" style={{ width: ringSize, height: ringSize }} />;
  const waveform = <Skeleton className="h-20 self-stretch rounded-xl" />;

  return match(isOnline)
    .with(true, () =>
      isCompact ? (
        <VStack flex={1} gap={12} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
          <VStack align="center">{clock}</VStack>
          {waveform}
        </VStack>
      ) : (
        <HStack flex={1} gap={20} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
          <VStack flex={1} gap={12} justify="center" align="center">
            {clock}
            {waveform}
          </VStack>
          <VStack flex={1} />
        </HStack>
      ),
    )
    .with(false, () => <VoiceNoteDigest.Offline />)
    .exhaustive();
};

function RecordCaptions(
  props: Omit<
    ComponentProps<typeof SentenceCaptionList>,
    'isLive' | 'contentBottomInset' | 'className'
  >,
) {
  const isCompact = useWindowSizeClass() === 'compact';
  const fontScaledSize = useFontScaledSize();
  const [isMarkHintPending] = useMyPendingCoachmark('voice-note-mark');

  return (
    <SentenceCaptionList
      {...props}
      isLive
      // 처음 안내가 조작 줄 위로 떠 자막 맨 아래를 덮는다. 방금 말한 문장이 그 위에 오게 한다
      contentBottomInset={isCompact && isMarkHintPending ? fontScaledSize(MARK_HINT_HEIGHT) : 0}
      className="min-h-24 flex-1"
    />
  );
}

interface RecordClockProps {
  state: VoiceCaptureState;
  limitMs: number | null;
}

function RecordClock({ state, limitMs }: RecordClockProps) {
  const { t } = useTranslation('voiceNote');
  const elapsedMs = useCaptureElapsedMs(state);

  return (
    <RecordingTimer
      elapsedMs={elapsedMs}
      limitMs={limitMs}
      label={state.status === 'paused' ? t('record.pausedLabel') : undefined}
    />
  );
}

export default function VoiceNoteRecordRoute() {
  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<VoiceNoteRecordScreen.Loading />}>
          <VoiceNoteRecordScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
