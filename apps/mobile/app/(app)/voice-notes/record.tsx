import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useMyPendingCoachmark } from '@src/features/feature-discovery/hooks/use-my-pending-coachmark';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { toPremiumBenefitAmounts } from '@src/features/subscription/utils/view-models/plan-benefit.view-model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import {
  RECORD_CONTROL_ICON_SIZE,
  RecordControl,
} from '@src/features/voice/components/note/record-control';
import { RecordingTimer } from '@src/features/voice/components/note/recording-timer';
import { SentenceCaptionList } from '@src/features/voice/components/note/sentence-caption-list';
import { VoiceNoteHeader } from '@src/features/voice/components/note/voice-note-header';
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
import { useVoiceNoteRecording } from '@src/features/voice/hooks/use-voice-note-recording';
import { voiceNoteHref } from '@src/features/voice/utils/navigation/voice-note-href';
import { errorMessageOf } from '@src/shared/errors/to-error';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useKeepScreenAwake } from '@src/shared/infra/keep-awake/use-keep-screen-awake';
import {
  Box,
  Button,
  HStack,
  PauseIcon,
  QueryErrorBoundary,
  StopIcon,
  StyledSafeAreaView,
  Text,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';
import { match, P } from 'ts-pattern';

const MARK_HINT_HEIGHT = 124;

function VoiceNoteRecordScreen() {
  const { t } = useTranslation('voiceNote');
  useKeepScreenAwake();
  const isCompact = useWindowSizeClass() === 'compact';
  const fontScaledSize = useFontScaledSize();
  const [isMarkHintPending] = useMyPendingCoachmark('voice-note-mark');
  const toast = useAppToast();
  const logger = useLogger();
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
      const { hasText } = recording;
      if (snapshot != null && EntitlementPolicy.hasFullAccess(snapshot)) {
        if (hasText) {
          toast.warning(t('limit.premium', { minutes }));
        }
        recording.finish();
        return;
      }
      const { voiceNoteMinutes: premiumMinutes } = toPremiumBenefitAmounts();
      gate.showLimit({
        title: t('limit.title', { minutes }),
        description: hasText
          ? t('limit.description', { premiumMinutes })
          : t('limit.descriptionEmpty', { premiumMinutes }),
        alternativeAction: hasText
          ? { label: t('limit.summarize'), onPress: () => recording.finish() }
          : undefined,
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
    if (VoiceCapturePolicy.isWrappingUp(state)) {
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

  /** 들은 내용이 없으면 끝낼 게 없어 이유를 알리고 묻는다. 묻는 동안 말이 들어왔으면 그 내용으로 정리한다 */
  const handleFinishPress = async () => {
    if (VoiceCapturePolicy.canFinish(state)) {
      recording.finish();
      return;
    }
    const shouldFinish = await confirmDialog.open({
      title: t('record.finishEmptyTitle'),
      description: t('record.finishEmptyDescription'),
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

  /** 닫기와 끝내기는 다시 누르면 되니 알리지 않고 진단만 남긴다 */
  const logActionFailure = (action: 'close' | 'finish') => (error: unknown) => {
    logger.warn(VOICE_NOTE_LOG_EVENT.RECORD_ACTION_FAILED, {
      action,
      error: errorMessageOf(error),
    });
  };
  const requestClose = () => {
    handleClose().catch(logActionFailure('close'));
  };
  const requestFinish = () => {
    handleFinishPress().catch(logActionFailure('finish'));
  };

  const closeOnBackPress = useEffectEvent(() => {
    requestClose();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', closeOnBackPress);
    return () => subscription.remove();
  }, []);

  const timer = <VoiceNoteRecordScreen.Clock state={state} limitMs={limitMs} />;
  const waveform = (
    <VoiceNoteRecordScreen.Waveform
      isActive={state.status === 'listening'}
      bookmarksMs={recording.bookmarksMs}
    />
  );
  const captions = (
    <SentenceCaptionList
      sentences={recording.sentences}
      interimText={recording.interimText}
      isLive
      // 처음 안내가 조작 줄 위로 떠 자막 맨 아래를 덮는다. 방금 말한 문장이 그 위에 오게 한다
      contentBottomInset={isCompact && isMarkHintPending ? fontScaledSize(MARK_HINT_HEIGHT) : 0}
      className="min-h-24 flex-1"
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
      <VoiceNoteHeader
        title={t('record.title')}
        onClose={requestClose}
        right={
          <RecognitionLanguageToggle
            value={locale}
            onValueChange={(next) => {
              handleLocaleChange(next).catch((error: unknown) => {
                logger.warn(VOICE_NOTE_LOG_EVENT.RECORD_LANGUAGE_CHANGE_FAILED, {
                  error: errorMessageOf(error),
                });
                toast.error(t('record.languageChangeFailed'));
              });
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

VoiceNoteRecordScreen.Waveform = function Waveform({
  isActive,
  bookmarksMs,
}: {
  isActive: boolean;
  bookmarksMs: readonly number[];
}) {
  return (
    <RecognizerWaveform isActive={isActive} bookmarksMs={bookmarksMs} className="self-stretch" />
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

/** 멈췄거나 실패했을 때. 왜 멈췄는지 알리고 정리·닫기·이어 듣기를 고르게 한다 */
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
    <StyledSafeAreaView className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteRecordScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
