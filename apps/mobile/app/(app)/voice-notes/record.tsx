import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechEvent, SpeechLocale } from '@src/core/ports/speech-recognizer';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { toPremiumBenefitAmounts } from '@src/features/subscription/utils/view-models/plan-benefit.view-model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { RecordingTimer } from '@src/features/voice/components/note/recording-timer';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteHeader } from '@src/features/voice/components/note/voice-note-header';
import {
  useLiveWaveform,
  WaveformTimeline,
} from '@src/features/voice/components/note/waveform-timeline';
import { RecognitionLanguageToggle } from '@src/features/voice/components/quick-voice/recognition-language-toggle';
import { VOICE_CLOCK_TICK_MS } from '@src/features/voice/constants/voice.constants';
import {
  VoiceCapturePolicy,
  type VoiceCaptureState,
} from '@src/features/voice/domains/voice-capture.model';
import { useMicrophonePermission } from '@src/features/voice/hooks/use-microphone-permission';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useSpeechContext } from '@src/features/voice/hooks/use-speech-context';
import { useVoiceNoteRecordParams } from '@src/features/voice/hooks/use-voice-note-params';
import { useVoiceNoteRecording } from '@src/features/voice/hooks/use-voice-note-recording';
import { voiceNoteHref } from '@src/features/voice/utils/navigation/voice-note-href';
import { getBarIndexAt } from '@src/features/voice/utils/view-models/waveform.view-model';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  FlagIcon,
  HStack,
  PauseIcon,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Text,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
import { ActivityIndicator, BackHandler } from 'react-native';
import { match, P } from 'ts-pattern';

function VoiceNoteRecordScreen() {
  const { t } = useTranslation('voiceNote');
  useKeepAwake();
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const getSpeechContext = useSpeechContext();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useMicrophonePermission();
  const maxSeconds =
    snapshot == null ? null : EntitlementPolicy.getMaxSeconds(snapshot, 'VOICE_NOTE');
  const limitMs = maxSeconds == null ? null : maxSeconds * 1_000;

  const { draftId: seedDraftId, entry } = useVoiceNoteRecordParams();

  const recording = useVoiceNoteRecording({
    accountId: me.id,
    locale,
    seedDraftId,
    entry,
    maxSeconds,
    onLimitReached: () => {
      const minutes = Math.round((maxSeconds ?? 0) / 60);
      if (snapshot != null && EntitlementPolicy.hasFullAccess(snapshot)) {
        toast.warning(t('limit.premium', { minutes }));
        recording.finish();
        return;
      }
      gate.showLimit({
        title: t('limit.title', { minutes }),
        description: t('limit.description', {
          premiumMinutes: toPremiumBenefitAmounts().voiceNoteMinutes,
        }),
        alternativeAction: { label: t('limit.summarize'), onPress: () => recording.finish() },
      });
    },
    onFinished: (draftId) => router.replace(voiceNoteHref(draftId)),
    onEmpty: () => {
      toast.warning(t('record.empty'));
      router.back();
    },
  });
  const { state } = recording;

  useEffect(() => {
    recording.start({ startLocale: locale, contextualStrings: getSpeechContext() }).catch(() => {
      toast.error(t('record.failedTitle'));
    });
    // 화면이 열릴 때 한 번만 듣기를 시작한다
  }, []);

  const handleClose = async () => {
    if (state.status === 'finalizing' || state.status === 'planning') {
      return;
    }
    if (!recording.hasText) {
      recording.discard();
      router.back();
      return;
    }
    // 듣기를 시작하기 전이면 끝낼 것이 없다. 넘겨받은 글자는 메모 탭의 초안에 그대로 있다
    if (state.status === 'idle') {
      router.back();
      return;
    }
    const shouldFinish = await confirmDialog.open({
      title: t('record.leaveTitle'),
      description: t('record.leaveDescription'),
      confirmLabel: t('record.leaveConfirm'),
      cancelLabel: t('record.leaveCancel'),
    });
    if (shouldFinish) {
      recording.finish();
    }
  };

  /** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
  const handleLocaleChange = async (next: SpeechLocale) => {
    if (await ensureMicrophonePermission('note', next)) {
      setLocale(next);
      await recording.changeLocale(next);
    }
  };

  const closeOnBackPress = useEffectEvent(() => {
    handleClose().catch(() => undefined);
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', closeOnBackPress);
    return () => subscription.remove();
  }, []);

  const canResume =
    VoiceCapturePolicy.canResume(state) && (limitMs == null || state.elapsedMs < limitMs);
  const timer = (
    <RecordingClock
      state={state}
      limitMs={limitMs}
      label={state.status === 'paused' ? t('record.pausedLabel') : undefined}
    />
  );
  const waveform = (
    <RecordingWaveform
      isActive={state.status === 'listening'}
      bookmarksMs={recording.bookmarksMs}
    />
  );
  const captions = (
    <SentenceCaptionList
      sentences={recording.sentences}
      interimText={recording.interimText}
      isLive
      className="min-h-24 flex-1"
    />
  );
  const footer = match(state)
    .with({ status: P.union('paused', 'failed') }, (stopped) => (
      <VStack gap={12}>
        <VStack gap={4} className="rounded-2xl bg-gray-1 px-4 py-3">
          <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
            {stopped.status === 'paused' ? t('record.pausedTitle') : t('record.failedTitle')}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {match(stopped)
              .with({ status: 'paused' }, ({ cause }) => t(`record.pausedDescription.${cause}`))
              .with(
                { status: 'failed', reason: P.union('not-allowed', 'service-not-allowed') },
                () => t('record.failedPermission'),
              )
              .otherwise(() => t('record.failedDescription'))}
          </Text>
        </VStack>
        <HStack gap={8}>
          {VoiceCapturePolicy.canFinish(stopped) && (
            <Box flex={1}>
              <Button
                variant="weak"
                color="dark"
                onPress={recording.finish}
                testID="voice-note-summarize"
              >
                {t('record.summarize')}
              </Button>
            </Box>
          )}
          {canResume && (
            <Box flex={1}>
              <Button onPress={recording.resume} testID="voice-note-resume">
                {t('record.resume')}
              </Button>
            </Box>
          )}
        </HStack>
      </VStack>
    ))
    .otherwise(() => (
      <VStack gap={12}>
        <HStack justify="center" align="start" gap={24}>
          <RecordControl
            label={t('record.pause')}
            onPress={recording.pause}
            isDisabled={state.status !== 'listening'}
            testID="voice-note-pause"
          >
            <PauseIcon width={22} height={22} colorClassName="text-gray-7" />
          </RecordControl>
          <RecordControl
            label={t('record.finish')}
            onPress={recording.finish}
            isDisabled={!VoiceCapturePolicy.canFinish(state)}
            isPrimary
            testID="voice-note-finish"
          >
            <Box className="size-5 rounded-sm bg-white" />
          </RecordControl>
          <RecordControl
            label={t('record.mark')}
            onPress={recording.mark}
            isDisabled={state.status !== 'listening'}
            testID="voice-note-mark"
          >
            <FlagIcon width={22} height={22} colorClassName="text-main" />
          </RecordControl>
        </HStack>
        <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
          {t('record.privacy')}
        </Text>
      </VStack>
    ));

  return (
    <VStack flex={1} gap={12} className="px-4 pb-3 pt-2">
      <VoiceNoteHeader
        title={t('record.title')}
        onClose={handleClose}
        right={
          <RecognitionLanguageToggle
            value={locale}
            onValueChange={(next) => {
              handleLocaleChange(next).catch(() => undefined);
            }}
          />
        }
      />
      {isCompact ? (
        <>
          <VStack align="center" className={cn(state.status === 'paused' && 'opacity-60')}>
            {timer}
          </VStack>
          {waveform}
          {captions}
          {footer}
        </>
      ) : (
        <HStack flex={1} gap={20}>
          <VStack flex={1} gap={12} justify="center" align="center">
            {timer}
            {waveform}
            {footer}
          </VStack>
          <VStack flex={1}>{captions}</VStack>
        </HStack>
      )}
    </VStack>
  );
}

/** 1초마다 시계만 다시 그린다. 자막과 조작 줄은 건드리지 않는다 */
function RecordingClock({
  state,
  limitMs,
  label,
}: {
  state: VoiceCaptureState;
  limitMs: number | null;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const isListening = state.status === 'listening';

  useEffect(() => {
    if (!isListening) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), VOICE_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  return (
    <RecordingTimer
      elapsedMs={VoiceCapturePolicy.getElapsedMs(state, now)}
      limitMs={limitMs}
      label={label}
    />
  );
}

/** 음량을 직접 구독해 UI 스레드 값만 바꾼다. 음량 이벤트(초당 20번)에 React가 다시 그리지 않는다 */
function RecordingWaveform({
  isActive,
  bookmarksMs,
}: {
  isActive: boolean;
  bookmarksMs: readonly number[];
}) {
  const speechRecognizer = useSpeechRecognizer();
  const waveform = useLiveWaveform();
  const { pushLevel } = waveform;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    return speechRecognizer.subscribe((event: SpeechEvent) => {
      if (event.type === 'volume') {
        pushLevel(event.level);
      }
    });
  }, [isActive, pushLevel, speechRecognizer]);

  return (
    <WaveformTimeline
      waveform={waveform}
      flagIndexes={bookmarksMs.map(getBarIndexAt)}
      className="self-stretch"
    />
  );
}

interface RecordControlProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isPrimary?: boolean;
  children: ReactNode;
}

function RecordControl({
  label,
  isPrimary = false,
  children,
  ...pressableProps
}: RecordControlProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(isPrimary ? 64 : 52);

  return (
    <VStack align="center" gap={8}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ width: size, height: size }}
        className={cn(
          'items-center justify-center rounded-full',
          isPrimary ? 'bg-main' : 'bg-gray-2',
          pressableProps.isDisabled === true && 'opacity-50',
        )}
        {...pressableProps}
      >
        {children}
      </PressableFeedback>
      <Text size="e1" shade={7} maxLines={1}>
        {label}
      </Text>
    </VStack>
  );
}

export default function VoiceNoteRecordRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<ActivityIndicator className="flex-1" />}>
          <VoiceNoteRecordScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
