import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { getPremiumBenefitAmounts } from '@src/features/billing/subscription/utils/plan-benefit.view-model';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  Flex,
  HStack,
  PauseIcon,
  STACK_CLOSE_ICON,
  StopIcon,
  SurfaceCard,
  Text,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { match, P } from 'ts-pattern';

import { VOICE_LOG_EVENT } from '../../constants/voice-log-events';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../../domains/voice-capture.model';
import { useCaptureElapsedMs } from '../../hooks/use-capture-elapsed-ms';
import { useEnsureMicrophonePermission } from '../../hooks/use-ensure-microphone-permission';
import { useReadSpeechContext } from '../../hooks/use-read-speech-context';
import { useRecognitionLanguage } from '../../hooks/use-recognition-language';
import { useVoiceNoteRecording } from '../../hooks/use-voice-note-recording';
import { voiceNoteRecordParamsSchema } from '../../schemas/voice-note-params.schema';
import { getRecordingRingLayout } from '../../utils/recording-timer.geometry';
import { RecognitionLanguageTabs } from '../recognition-language-tabs';
import { SentenceCaptionList } from '../sentence-caption-list';
import { VoiceNoteOffline } from '../voice-note-offline';
import { RecognizerWaveform } from './recognizer-waveform';
import { RECORD_BUTTON_ICON_SIZE, RecordButton } from './record-button';
import { RecordingTimer } from './recording-timer';
import { VoiceNoteMarkControl } from './voice-note-mark-control';

const MARK_HINT_HEIGHT = 124;

/** 화면 전체가 녹음이라 이 컴포넌트가 곧 화면이다. 들은 글자 없이 끝나면 돌아간다 */
export function VoiceNoteRecorder() {
  const { t } = useTranslation('voiceNote');
  const isCompact = useWindowSizeClass() === 'compact';
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedError('voice');
  const accountId = useSuspenseMyAccountId();
  const { maxSeconds, limitMs, finishOrPromptLimit } = useVoiceNoteRecordLimit();
  const getSpeechContext = useReadSpeechContext();
  const [locale] = useRecognitionLanguage();
  const [{ draftId: seedDraftId, entry }] = useRouteParams(voiceNoteRecordParamsSchema);

  const recording = useVoiceNoteRecording({
    accountId,
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
  const requestClose = useRecordClose(recording);
  const requestFinish = useRecordFinish(recording);
  // 글자를 받을 때마다 recording이 새로 만들어진다. 헤더 옵션이 그때마다 바뀌면 내비게이터까지 다시 그려져 정체성을 고정한다
  const close = useSingleTap(requestClose);
  const changeLocaleRef = useRef(recording.changeLocale);
  useLayoutEffect(() => {
    changeLocaleRef.current = recording.changeLocale;
  });
  const { state } = recording;

  // 화면에 들어올 때 한 번만 녹음을 시작한다. 그 시점의 언어·힌트를 읽는다
  const startRecording = useEffectEvent(() => {
    recording.start({ startLocale: locale, hintWords: getSpeechContext() }).catch((error) => {
      reportUnexpectedError(error);
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
            <RecordLanguageTabs onLocaleChange={(next) => changeLocaleRef.current(next)} />
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
            <VoiceNoteRecorder.Controls
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
          <VoiceNoteRecorder.Controls
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

interface VoiceNoteRecorderControlsProps {
  state: VoiceCaptureState;
  limitMs: number | null;
  markCount: number;
  onPause: () => void;
  onFinish: () => void;
  onMark: () => void;
  onSummarize: () => void;
  onClose: () => void;
  onResume: () => void;
}

VoiceNoteRecorder.Controls = function Controls({
  state,
  limitMs,
  markCount,
  onPause,
  onFinish,
  onMark,
  onSummarize,
  onClose,
  onResume,
}: VoiceNoteRecorderControlsProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack gap={12} className="self-stretch">
      {match(state)
        .with({ status: P.union('paused', 'failed') }, (stopped) => (
          <VoiceNoteRecorder.StoppedControls
            state={stopped}
            canResume={VoiceCapturePolicy.canResumeWithinLimit(stopped, limitMs)}
            onSummarize={onSummarize}
            onClose={onClose}
            onResume={onResume}
          />
        ))
        .otherwise(() => (
          <Box className="w-full max-w-90 self-center">
            <VoiceNoteRecorder.ListeningControls
              isListening={state.status === 'listening'}
              markCount={markCount}
              onPause={onPause}
              onFinish={onFinish}
              onMark={onMark}
            />
          </Box>
        ))}
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('record.privacy')}
      </Text>
    </VStack>
  );
};

interface VoiceNoteRecorderListeningControlsProps {
  isListening: boolean;
  markCount: number;
  onPause: () => void;
  onFinish: () => void;
  onMark: () => void;
}

VoiceNoteRecorder.ListeningControls = function ListeningControls({
  isListening,
  markCount,
  onPause,
  onFinish,
  onMark,
}: VoiceNoteRecorderListeningControlsProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(RECORD_BUTTON_ICON_SIZE);

  return (
    <HStack align="start">
      <RecordButton
        label={t('record.pause')}
        onPress={onPause}
        isDisabled={!isListening}
        testID="voice-note-pause"
      >
        <PauseIcon width={iconSize} height={iconSize} colorClassName="text-gray-7" />
      </RecordButton>
      <RecordButton
        label={t('record.finish')}
        onPress={onFinish}
        isDisabled={!isListening}
        isPrimary
        testID="voice-note-finish"
      >
        <StopIcon width={iconSize} height={iconSize} colorClassName="text-white dark:text-gray-9" />
      </RecordButton>
      <VoiceNoteMarkControl markCount={markCount} isListening={isListening} onPress={onMark} />
    </HStack>
  );
};

interface VoiceNoteRecorderStoppedControlsProps {
  state: Extract<VoiceCaptureState, { status: 'paused' | 'failed' }>;
  canResume: boolean;
  onSummarize: () => void;
  onClose: () => void;
  onResume: () => void;
}

VoiceNoteRecorder.StoppedControls = function StoppedControls({
  state,
  canResume,
  onSummarize,
  onClose,
  onResume,
}: VoiceNoteRecorderStoppedControlsProps) {
  const { t } = useTranslation('voiceNote');
  const hasHeard = VoiceCapturePolicy.canFinish(state);

  return (
    <VStack gap={12}>
      <SurfaceCard className="gap-1 px-4 py-3">
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
      </SurfaceCard>
      <HStack className="gap-2">
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

interface RecordLanguageTabsProps {
  onLocaleChange: (next: SpeechLocale) => Promise<void>;
}

/** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
function RecordLanguageTabs({ onLocaleChange }: RecordLanguageTabsProps) {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const logger = useLogger();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useEnsureMicrophonePermission();

  const handleLocaleChange = async (next: SpeechLocale) => {
    if (await ensureMicrophonePermission('note', next)) {
      await onLocaleChange(next);
      setLocale(next);
    }
  };

  return (
    <RecognitionLanguageTabs
      value={locale}
      onValueChange={(next) => {
        handleLocaleChange(next).catch((error: unknown) => {
          logger.warn(VOICE_LOG_EVENT.RECORD_LANGUAGE_CHANGE_FAILED, {
            error: getErrorMessage(error),
          });
          toast.error(t('record.languageChangeFailed'));
        });
      }}
    />
  );
}

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

interface RecordCloseOptions {
  state: VoiceCaptureState;
  hasText: boolean;
  discard: () => void;
  finish: () => void;
}

/** 닫기·Android 뒤로 가기. 들은 글자가 있으면 끝낼지 묻고, 실패는 다시 누르면 되니 진단만 남긴다 */
function useRecordClose({ state, hasText, discard, finish }: RecordCloseOptions) {
  const { t } = useTranslation('voiceNote');
  const logger = useLogger();
  const confirmDialog = useConfirmDialog();

  const handleClose = async () => {
    if (VoiceCapturePolicy.isWrappingUp(state)) {
      return;
    }
    if (!hasText) {
      discard();
      router.back();
      return;
    }
    // 듣기를 시작하기 전이면 끝낼 것이 없다. 넘겨받은 글자는 메모 탭의 초안에 그대로 있다
    if (state.status === 'idle') {
      router.back();
      return;
    }
    const shouldFinish = await confirmDialog.openAsync({
      title: t('record.leaveTitle'),
      description: t('record.leaveDescription'),
      confirmLabel: t('record.leaveConfirm'),
      cancelLabel: t('record.leaveCancel'),
    });
    if (shouldFinish) {
      finish();
    }
  };

  const requestClose = () => {
    handleClose().catch((error: unknown) => {
      logger.warn(VOICE_LOG_EVENT.RECORD_ACTION_FAILED, {
        action: 'close',
        error: getErrorMessage(error),
      });
    });
  };

  useAndroidBackHandler({
    onBack: () => {
      requestClose();
      return true;
    },
  });

  return requestClose;
}

interface RecordFinishOptions {
  state: VoiceCaptureState;
  finish: () => void;
}

/** 끝내기. 아직 들은 글자가 없으면 그래도 끝낼지 묻는다 */
function useRecordFinish({ state, finish }: RecordFinishOptions) {
  const { t } = useTranslation('voiceNote');
  const logger = useLogger();
  const confirmDialog = useConfirmDialog();

  const handleFinish = async () => {
    if (VoiceCapturePolicy.canFinish(state)) {
      finish();
      return;
    }
    const shouldFinish = await confirmDialog.openAsync({
      title: t('record.finishEmptyTitle'),
      description: t('record.finishEmptyDescription'),
      confirmLabel: t('record.leaveConfirm'),
      cancelLabel: t('record.leaveCancel'),
    });
    if (shouldFinish) {
      finish();
    }
  };

  return () => {
    handleFinish().catch((error: unknown) => {
      logger.warn(VOICE_LOG_EVENT.RECORD_ACTION_FAILED, {
        action: 'finish',
        error: getErrorMessage(error),
      });
    });
  };
}

function useVoiceNoteRecordLimit() {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const maxSeconds =
    snapshot == null ? null : EntitlementPolicy.getMaxSeconds(snapshot, 'VOICE_NOTE');

  const finishOrPromptLimit = ({ hasText, finish }: { hasText: boolean; finish: () => void }) => {
    const minutes = Math.round(((maxSeconds ?? 0) * SECOND_MS) / MINUTE_MS);
    if (snapshot != null && EntitlementPolicy.hasFullAccess(snapshot)) {
      if (hasText) {
        toast.warning(t('limit.premium', { minutes }));
      }
      finish();
      return;
    }
    const { voiceNoteMinutes: premiumMinutes } = getPremiumBenefitAmounts();
    gate.promptLimit({
      title: t('limit.title', { minutes }),
      description: hasText
        ? t('limit.description', { premiumMinutes })
        : t('limit.descriptionEmpty', { premiumMinutes }),
      alternativeAction: hasText ? { label: t('limit.summarize'), onPress: finish } : undefined,
    });
  };

  return {
    maxSeconds,
    limitMs: maxSeconds == null ? null : maxSeconds * SECOND_MS,
    finishOrPromptLimit,
  };
}
