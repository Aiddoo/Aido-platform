import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useMyPendingCoachmark } from '@src/features/feature-discovery/hooks/use-my-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import {
  RECORD_CONTROL_ICON_SIZE,
  RecordControl,
} from '@src/features/voice/components/note/record-control';
import { RecordingTimer } from '@src/features/voice/components/note/recording-timer';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteMarkControl } from '@src/features/voice/components/note/voice-note-mark-control';
import { VoiceNoteScreenLoading } from '@src/features/voice/components/note/voice-note-screen-loading';
import { RecognizerWaveform } from '@src/features/voice/components/note/waveform-timeline';
import { RecognitionLanguageToggle } from '@src/features/voice/components/quick-voice/recognition-language-toggle';
import { VOICE_NOTE_LOG_EVENT } from '@src/features/voice/constants/voice-note-log-events';
import {
  VoiceCapturePolicy,
  type VoiceCaptureState,
} from '@src/features/voice/domains/voice-capture.model';
import { useCaptureElapsedMs } from '@src/features/voice/hooks/use-capture-elapsed-ms';
import { useMicrophonePermission } from '@src/features/voice/hooks/use-microphone-permission';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useSpeechContext } from '@src/features/voice/hooks/use-speech-context';
import { useVoiceNoteRecordParams } from '@src/features/voice/hooks/use-voice-note-params';
import { useVoiceNoteRecordExit } from '@src/features/voice/hooks/use-voice-note-record-exit';
import { useVoiceNoteRecordLimit } from '@src/features/voice/hooks/use-voice-note-record-limit';
import { useVoiceNoteRecording } from '@src/features/voice/hooks/use-voice-note-recording';
import { voiceNoteHref } from '@src/features/voice/utils/navigation/voice-note-href';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useKeepScreenAwake } from '@src/shared/infra/keep-awake/use-keep-screen-awake';
import {
  Box,
  Button,
  HStack,
  PauseIcon,
  QueryErrorBoundary,
  STACK_CLOSE_ICON,
  StopIcon,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { type ComponentProps, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { match, P } from 'ts-pattern';

const MARK_HINT_HEIGHT = 124;

function VoiceNoteRecordScreen() {
  const { t } = useTranslation('voiceNote');
  useKeepScreenAwake();
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const { maxSeconds, limitMs, notifyLimit } = useVoiceNoteRecordLimit();
  const getSpeechContext = useSpeechContext();
  const [locale] = useRecognitionLanguage();
  const { draftId: seedDraftId, entry } = useVoiceNoteRecordParams();

  const recording = useVoiceNoteRecording({
    accountId: me.id,
    locale,
    seedDraftId,
    entry,
    maxSeconds,
    onLimitReached: () => notifyLimit(recording),
    onFinished: (draftId) => router.replace(voiceNoteHref(draftId)),
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
    recording.start({ startLocale: locale, contextualStrings: getSpeechContext() }).catch(() => {
      toast.error(t('record.failedTitle'));
    });
  }, []);

  const clock = <VoiceNoteRecordScreen.Clock state={state} limitMs={limitMs} />;
  const waveform = (
    <RecognizerWaveform
      isActive={state.status === 'listening'}
      bookmarksMs={recording.bookmarksMs}
      className="self-stretch"
    />
  );
  const captions = (
    <VoiceNoteRecordScreen.Captions
      sentences={recording.sentences}
      interimText={recording.interimText}
    />
  );
  const footer = (
    <VStack gap={12} className="self-stretch">
      {match(state)
        .with({ status: P.union('paused', 'failed') }, (stopped) => (
          <VoiceNoteRecordScreen.Stopped
            state={stopped}
            canResume={VoiceCapturePolicy.canResumeWithinLimit(stopped, limitMs)}
            onSummarize={recording.finish}
            onClose={requestClose}
            onResume={recording.resume}
          />
        ))
        .otherwise(() => (
          <VoiceNoteRecordScreen.Controls
            isListening={state.status === 'listening'}
            markCount={recording.markCount}
            onPause={recording.pause}
            onFinish={requestFinish}
            onMark={recording.mark}
          />
        ))}
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('record.privacy')}
      </Text>
    </VStack>
  );

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <VoiceNoteRecordScreen.LanguageToggle
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

/** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
VoiceNoteRecordScreen.LanguageToggle = function LanguageToggle({
  onLocaleChange,
}: {
  onLocaleChange: (next: SpeechLocale) => Promise<void>;
}) {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const logger = useLogger();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useMicrophonePermission();

  const handleLocaleChange = async (next: SpeechLocale) => {
    if (await ensureMicrophonePermission('note', next)) {
      setLocale(next);
      await onLocaleChange(next);
    }
  };

  return (
    <RecognitionLanguageToggle
      value={locale}
      onValueChange={(next) => {
        handleLocaleChange(next).catch((error: unknown) => {
          logger.warn(VOICE_NOTE_LOG_EVENT.RECORD_LANGUAGE_CHANGE_FAILED, {
            error: getErrorMessage(error),
          });
          toast.error(t('record.languageChangeFailed'));
        });
      }}
    />
  );
};

VoiceNoteRecordScreen.Clock = function Clock({
  state,
  limitMs,
}: {
  state: VoiceCaptureState;
  limitMs: number | null;
}) {
  const { t } = useTranslation('voiceNote');
  const elapsedMs = useCaptureElapsedMs(state);

  return (
    <RecordingTimer
      elapsedMs={elapsedMs}
      limitMs={limitMs}
      label={state.status === 'paused' ? t('record.pausedLabel') : undefined}
    />
  );
};

VoiceNoteRecordScreen.Captions = function Captions(
  props: Pick<ComponentProps<typeof SentenceCaptionList>, 'sentences' | 'interimText'>,
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
};

VoiceNoteRecordScreen.Controls = function Controls({
  isListening,
  markCount,
  onPause,
  onFinish,
  onMark,
}: {
  isListening: boolean;
  markCount: number;
  onPause: () => void;
  onFinish: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(RECORD_CONTROL_ICON_SIZE);

  return (
    <HStack align="start" className="w-full max-w-90 self-center">
      <RecordControl
        label={t('record.pause')}
        onPress={onPause}
        isDisabled={!isListening}
        testID="voice-note-pause"
      >
        <PauseIcon width={iconSize} height={iconSize} colorClassName="text-gray-7" />
      </RecordControl>
      <RecordControl
        label={t('record.finish')}
        onPress={onFinish}
        isDisabled={!isListening}
        isPrimary
        testID="voice-note-finish"
      >
        <StopIcon width={iconSize} height={iconSize} colorClassName="text-white dark:text-gray-9" />
      </RecordControl>
      <VoiceNoteMarkControl markCount={markCount} isListening={isListening} onPress={onMark} />
    </HStack>
  );
};

VoiceNoteRecordScreen.Stopped = function Stopped({
  state,
  canResume,
  onSummarize,
  onClose,
  onResume,
}: {
  state: Extract<VoiceCaptureState, { status: 'paused' | 'failed' }>;
  canResume: boolean;
  onSummarize: () => void;
  onClose: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation('voiceNote');
  const hasHeard = VoiceCapturePolicy.canFinish(state);

  return (
    <VStack gap={12}>
      <VStack gap={4} className="rounded-2xl bg-gray-1 px-4 py-3">
        <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
          {state.status === 'paused' ? t('record.pausedTitle') : t('record.failedTitle')}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {match(state)
            .with({ status: 'paused' }, ({ cause }) =>
              hasHeard
                ? t(`record.pausedDescription.${cause}`)
                : t(`record.pausedEmptyDescription.${cause}`),
            )
            .with({ status: 'failed', reason: P.union('not-allowed', 'service-not-allowed') }, () =>
              t('record.failedPermission'),
            )
            .otherwise(() =>
              hasHeard ? t('record.failedDescription') : t('record.failedEmptyDescription'),
            )}
        </Text>
      </VStack>
      <HStack gap={8}>
        <Box flex={1}>
          {hasHeard ? (
            <Button
              size="large"
              variant="weak"
              color="dark"
              onPress={onSummarize}
              testID="voice-note-summarize"
            >
              {t('record.summarize')}
            </Button>
          ) : (
            <Button
              size="large"
              variant="weak"
              color="dark"
              onPress={onClose}
              testID="voice-note-stopped-close"
            >
              {t('record.close')}
            </Button>
          )}
        </Box>
        {canResume && (
          <Box flex={1}>
            <Button size="large" onPress={onResume} testID="voice-note-resume">
              {t('record.resume')}
            </Button>
          </Box>
        )}
      </HStack>
    </VStack>
  );
};

export default function VoiceNoteRecordRoute() {
  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteRecordScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
