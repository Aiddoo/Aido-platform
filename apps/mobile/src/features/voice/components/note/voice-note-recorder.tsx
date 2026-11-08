import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { Flex, HStack, STACK_CLOSE_ICON, VStack } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

import type { VoiceCaptureState } from '../../domains/voice-capture.model';
import { useCaptureElapsedMs } from '../../hooks/use-capture-elapsed-ms';
import { useReadSpeechContext } from '../../hooks/use-read-speech-context';
import { useRecognitionLanguage } from '../../hooks/use-recognition-language';
import { useVoiceNoteRecordExit } from '../../hooks/use-voice-note-record-exit';
import { useVoiceNoteRecordLimit } from '../../hooks/use-voice-note-record-limit';
import { useVoiceNoteRecording } from '../../hooks/use-voice-note-recording';
import { voiceNoteRecordParamsSchema } from '../../schemas/voice-note-params.schema';
import { getRecordingRingLayout } from '../../utils/recording-timer.geometry';
import { RecognizerWaveform } from './recognizer-waveform';
import { RecordingTimer } from './recording-timer';
import { SentenceCaptionList } from './sentence-caption-list';
import { VoiceNoteOffline } from './voice-note-offline';
import { VoiceNoteRecordFooter } from './voice-note-record-footer';
import { VoiceNoteRecordLanguageTabs } from './voice-note-record-language-tabs';

const MARK_HINT_HEIGHT = 124;

/**
 * 말로 메모하기 녹음. 화면 전체가 녹음이라 이 컴포넌트가 곧 화면이다(헤더의 언어 전환과 닫기 포함).
 * 열리면 바로 듣기를 시작하고, 끝내면 초안 화면으로 바꾸고, 들은 글자 없이 끝나면 돌아간다.
 */
export function VoiceNoteRecorder() {
  const { t } = useTranslation('voiceNote');
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const { maxSeconds, limitMs, finishOrPromptLimit } = useVoiceNoteRecordLimit();
  const getSpeechContext = useReadSpeechContext();
  const [locale] = useRecognitionLanguage();
  const [{ draftId: seedDraftId, entry }] = useRouteParams(voiceNoteRecordParamsSchema);

  const recording = useVoiceNoteRecording({
    accountId: me.id,
    locale,
    seedDraftId,
    entry,
    maxSeconds,
    onLimitReached: () => finishOrPromptLimit(recording),
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

  // 화면에 들어올 때 한 번만 녹음을 시작한다. 그 시점의 언어·힌트를 읽는다
  const startRecording = useEffectEvent(() => {
    recording.start({ startLocale: locale, hintWords: getSpeechContext() }).catch(() => {
      toast.error(t('record.failedTitle'));
    });
  });
  useEffect(() => {
    startRecording();
  }, []);

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <VoiceNoteRecordLanguageTabs onLocaleChange={(next) => changeLocaleRef.current(next)} />
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
      {/* 폴드를 접고 펴도 파형과 자막이 다시 마운트되지 않게 같은 트리에서 방향만 바꾼다 */}
      <Flex direction={isCompact ? 'column' : 'row'} flex={1} gap={isCompact ? 12 : 20}>
        <VStack
          flex={isCompact ? 0 : 1}
          gap={12}
          justify={isCompact ? 'start' : 'center'}
          align="center"
        >
          <VStack align="center" className={cn(state.status === 'paused' && 'opacity-60')}>
            <RecordClock state={state} limitMs={limitMs} />
          </VStack>
          <RecognizerWaveform
            level={recording.level}
            isActive={state.status === 'listening'}
            bookmarksMs={recording.bookmarksMs}
            className="self-stretch"
          />
          {!isCompact && (
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
          )}
        </VStack>
        <VStack flex={1}>
          <RecordCaptions sentences={recording.sentences} interimText={recording.interimText} />
        </VStack>
        {isCompact && (
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
        )}
      </Flex>
    </VStack>
  );
}

/** 헤더는 레이아웃이 미리 그려 받은 뒤에 밀리지 않는다. 시계와 파형 자리를 받은 뒤와 같은 배치로 잡는다 */
VoiceNoteRecorder.Loading = function Loading() {
  const isOnline = useIsOnline();
  const isCompact = useWindowSizeClass() === 'compact';
  const { height: windowHeight } = useWindowDimensions();
  const { size: ringSize } = getRecordingRingLayout(windowHeight);

  return match(isOnline)
    .with(true, () =>
      isCompact ? (
        <VStack flex={1} gap={12} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
          <VStack align="center">
            <Skeleton className="rounded-full" style={{ width: ringSize, height: ringSize }} />
          </VStack>
          <Skeleton className="h-20 self-stretch rounded-xl" />
        </VStack>
      ) : (
        <HStack flex={1} gap={20} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
          <VStack flex={1} gap={12} justify="center" align="center">
            <Skeleton className="rounded-full" style={{ width: ringSize, height: ringSize }} />
            <Skeleton className="h-20 self-stretch rounded-xl" />
          </VStack>
          <VStack flex={1} />
        </HStack>
      ),
    )
    .with(false, () => <VoiceNoteOffline className="px-4" />)
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
