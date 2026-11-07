import { zodResolver } from '@hookform/resolvers/zod';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  Text,
  TextButton,
  useKeyboardSheetBodyMaxHeight,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { type ReactNode, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { AUTO_FINISH_SILENCE_MS, LISTENING_PANEL_HEIGHT } from '../../constants/voice.constants';
import { PlanReviewPolicy } from '../../domains/plan-review.model';
import { VoiceCapturePolicy } from '../../domains/voice-capture.model';
import { isTranscriptEmpty } from '../../domains/voice-transcript.model';
import { useCaptureElapsedMs } from '../../hooks/use-capture-elapsed-ms';
import { planReviewFormSchema } from '../../schemas/plan-review-form.schema';
import { type CapturedPlan, type VoiceCaptureState } from '../../schemas/voice-capture.schema';
import { formatMediaTime } from '../../utils/format-media-time';
import { PlanReview } from '../plan/plan-review';
import { VoiceVisual } from '../visualizers/voice-visual';
import { LiveTranscript } from './live-transcript';
import { QuickVoiceHeader } from './quick-voice-header';
import { RecognitionLanguageTabs } from './recognition-language-tabs';

interface QuickVoicePanelProps {
  state: VoiceCaptureState;
  level: SharedValue<number>;
  isQuiet: boolean;
  locale: SpeechLocale;
  onLocaleChange: (locale: SpeechLocale) => void;
  onFinish: () => void;
  onCancel: () => void;
  onResume: () => void;
  onContinueAsVoiceNote: () => void;
}

export function QuickVoicePanel({
  state,
  level,
  isQuiet,
  locale,
  onLocaleChange,
  onFinish,
  onCancel,
  onResume,
  onContinueAsVoiceNote,
}: QuickVoicePanelProps) {
  const { t } = useTranslation('voice');
  const isPaused = state.status === 'paused';
  const isListening = state.status === 'listening';
  const isOverLimit = VoiceCapturePolicy.shouldOfferVoiceNote(state);
  const canFinish = VoiceCapturePolicy.canFinish(state);

  return (
    <SheetPanel
      center={<ListeningClock state={state} />}
      right={<RecognitionLanguageTabs value={locale} onValueChange={onLocaleChange} />}
      onClose={onCancel}
      testID="quick-voice-listening"
    >
      <Box flex={1}>
        <LiveTranscript
          transcript={state.transcript}
          placeholder={isPaused ? undefined : t('listening.prompt')}
        />
      </Box>

      {!isOverLimit && (
        <Box className={cn(isPaused && 'opacity-60')}>
          <VoiceVisual level={level} isActive={isListening} />
        </Box>
      )}

      {match({ isOverLimit, isPaused })
        .with({ isOverLimit: true }, () => (
          <VStack gap={8} testID="quick-voice-limit">
            <VStack gap={4}>
              <Text size="b3" weight="semibold" align="center" lineBreakStrategyIOS="hangul-word">
                {canFinish ? t('limit.title') : t('limit.titleEmpty')}
              </Text>
              <Text size="b4" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
                {canFinish ? t('limit.description') : t('limit.descriptionEmpty')}
              </Text>
            </VStack>
            {canFinish ? (
              <Button size="large" onPress={onFinish} testID="quick-voice-finish">
                {t('limit.finish')}
              </Button>
            ) : (
              <Button
                size="large"
                onPress={onContinueAsVoiceNote}
                testID="quick-voice-continue-as-note"
              >
                {t('limit.continueAsNote')}
              </Button>
            )}
            {canFinish && (
              <Button
                size="large"
                variant="weak"
                color="dark"
                onPress={onContinueAsVoiceNote}
                testID="quick-voice-continue-as-note"
              >
                {t('limit.continueAsNote')}
              </Button>
            )}
          </VStack>
        ))
        .with({ isPaused: true }, () => (
          <VStack gap={8}>
            <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
              {t('listening.pausedHint')}
            </Text>
            <HStack gap={8} align="center">
              {canFinish && (
                <Box flex={1}>
                  <Button
                    size="large"
                    variant="weak"
                    color="dark"
                    onPress={onFinish}
                    testID="quick-voice-finish"
                  >
                    {t('listening.done')}
                  </Button>
                </Box>
              )}
              <Box flex={1}>
                <Button size="large" onPress={onResume} testID="quick-voice-resume">
                  {t('listening.resume')}
                </Button>
              </Box>
            </HStack>
          </VStack>
        ))
        .otherwise(() => (
          <VStack gap={8}>
            <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
              {t('listening.autoFinishHint')}
            </Text>
            <Box className="overflow-hidden rounded-xl">
              <Button
                size="large"
                isDisabled={!canFinish}
                onPress={onFinish}
                testID="quick-voice-finish"
              >
                {t('listening.done')}
              </Button>
              <SilenceFill isQuiet={isQuiet && canFinish} />
            </Box>
          </VStack>
        ))}
    </SheetPanel>
  );
}

QuickVoicePanel.Planning = function Planning({
  state,
  onCancel,
}: {
  state: VoiceCaptureState;
  onCancel: () => void;
}) {
  const { t } = useTranslation('voice');

  return (
    <SheetPanel
      center={
        <Text size="b4" weight="semibold" shade={7} maxLines={1}>
          {t('planning.title')}
        </Text>
      }
      onClose={onCancel}
      testID="quick-voice-planning"
    >
      <Box flex={1}>
        <LiveTranscript transcript={state.transcript} isWordFadeEnabled={false} />
      </Box>
      <QuickVoicePanel.CardsLoading />
      <TextButton
        size="small"
        className="self-center"
        onPress={onCancel}
        testID="quick-voice-planning-cancel"
      >
        {t('planning.cancel')}
      </TextButton>
    </SheetPanel>
  );
};

QuickVoicePanel.CardsLoading = function CardsLoading() {
  return (
    <VStack gap={8}>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </VStack>
  );
};

interface ReviewProps extends CapturedPlan {
  fallbackCategoryId: number;
  onMemoChanged: () => void;
  onApplied: () => void;
  onRestart: () => void;
  onTypeInstead: () => void;
}

/** 계획을 고르는 단계. 이 단계가 떠 있는 동안 폼이 살아 있어 카드 시트를 오가거나 저장에 실패해도 고친 값이 남는다 */
QuickVoicePanel.Review = function Review({
  plan,
  isCharged,
  fallbackCategoryId,
  onMemoChanged,
  onApplied,
  onRestart,
  onTypeInstead,
}: ReviewProps) {
  const { t } = useTranslation('voice');
  const form = useForm({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: PlanReviewPolicy.createFormValues(plan),
    mode: 'onChange',
  });
  const bodyMaxHeight = useKeyboardSheetBodyMaxHeight();
  const restartButton = (
    <Box className="flex-1">
      <Button variant="weak" color="dark" onPress={onRestart} testID="quick-voice-restart">
        {t('review.restart')}
      </Button>
    </Box>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} testID="quick-voice-review">
      <PlanReview
        surface="sheet"
        style={{ maxHeight: bodyMaxHeight }}
        form={form}
        plan={plan}
        fallbackCategoryId={fallbackCategoryId}
        isCharged={isCharged}
        secondaryAction={
          plan.actions.length === 0 ? (
            <HStack gap={8}>
              {restartButton}
              <Box className="flex-1">
                <Button onPress={onTypeInstead} testID="quick-voice-type-instead">
                  {t('review.typeInstead')}
                </Button>
              </Box>
            </HStack>
          ) : (
            restartButton
          )
        }
        onMemoChanged={onMemoChanged}
        onApplied={onApplied}
      />
    </Animated.View>
  );
};

QuickVoicePanel.Failed = function Failed({
  state,
  isConsentRequired = false,
  isTypedTextKept = false,
  onResume,
  onRetryPlanning,
}: {
  state: VoiceCaptureState;
  isConsentRequired?: boolean;
  isTypedTextKept?: boolean;
  onResume: () => void;
  onRetryPlanning: () => void;
}) {
  const { t } = useTranslation('voice');
  const canResume = VoiceCapturePolicy.canResume(state);
  const canRetryPlanning = VoiceCapturePolicy.canRetryPlanning(state);

  if (state.status !== 'failed') {
    return null;
  }

  return (
    <HStack
      gap={8}
      align="center"
      className="rounded-xl bg-gray-2 px-4 py-3"
      testID="quick-voice-failed"
    >
      <Text size="b4" shade={7} className="flex-1 shrink" lineBreakStrategyIOS="hangul-word">
        {match(state)
          .when(
            () => canRetryPlanning && isConsentRequired,
            () => t('failed.consentRequired'),
          )
          .when(
            ({ transcript }) => isTranscriptEmpty(transcript),
            () => t('failed.nothingHeard'),
          )
          .when(
            () => isTypedTextKept,
            () => t('failed.typedTextKept'),
          )
          .otherwise(() => t('failed.keptText'))}
      </Text>
      {canResume && (
        <TextButton size="small" onPress={onResume}>
          {t('failed.resume')}
        </TextButton>
      )}
      {canRetryPlanning && (
        <TextButton size="small" onPress={onRetryPlanning}>
          {t('failed.retry')}
        </TextButton>
      )}
    </HStack>
  );
};

interface SheetPanelProps {
  center: ReactNode;
  right?: ReactNode;
  onClose: () => void;
  testID: string;
  children: ReactNode;
}

/** 높이를 고정해야 긴 자막이 시트를 키워 조작을 화면 밖으로 밀지 않는다(QA: 93초 발화) */
function SheetPanel({ center, right, onClose, testID, children }: SheetPanelProps) {
  const { height: windowHeight } = useWindowDimensions();
  const bodyMaxHeight = useKeyboardSheetBodyMaxHeight();
  const height = clamp(
    windowHeight * LISTENING_PANEL_HEIGHT.windowRatio,
    LISTENING_PANEL_HEIGHT.min,
    bodyMaxHeight,
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{ height }}
      testID={testID}
    >
      <VStack flex={1} gap={16}>
        <QuickVoiceHeader center={center} right={right} onClose={onClose} />
        {children}
      </VStack>
    </Animated.View>
  );
}

function ListeningClock({ state }: { state: VoiceCaptureState }) {
  const elapsedMs = useCaptureElapsedMs(state);

  return (
    <HStack gap={8} align="center">
      <Box
        className={cn(
          'size-2 rounded-full',
          state.status === 'listening' ? 'bg-main' : 'bg-gray-4',
        )}
      />
      <Text size="b4" weight="semibold" shade={7} className="tabular-nums">
        {formatMediaTime(elapsedMs)}
      </Text>
    </HStack>
  );
}

function SilenceFill({ isQuiet }: { isQuiet: boolean }) {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      isQuiet && !isReducedMotion
        ? withTiming(1, { duration: AUTO_FINISH_SILENCE_MS, easing: Easing.linear })
        : 0,
    );
    return () => cancelAnimation(progress);
  }, [isQuiet, isReducedMotion, progress]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-0 bg-white/25"
      style={[style, { transformOrigin: 'left' }]}
    />
  );
}
