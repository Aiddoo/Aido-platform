import { zodResolver } from '@hookform/resolvers/zod';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, CloseIcon, HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AUTO_FINISH_SILENCE_MS,
  LISTENING_PANEL_HEIGHT_RATIO,
  VOICE_CLOCK_TICK_MS,
} from '../../constants/voice.constants';
import {
  createPlanReviewFormValues,
  type PlanReviewFormValues,
  planReviewFormSchema,
} from '../../domains/plan-review-form.schema';
import {
  type CapturedPlan,
  VoiceCapturePolicy,
  type VoiceCaptureState,
} from '../../domains/voice-capture.model';
import { getTranscriptText } from '../../domains/voice-transcript.model';
import { formatMediaTime } from '../../utils/format-media-time';
import { PlanReview } from '../plan/plan-review';
import { SheetEdgeGlow } from '../visualizers/sheet-edge-glow';
import { VoiceOrb } from '../visualizers/voice-orb';
import { Waveform } from '../visualizers/waveform';
import { LiveTranscript } from './live-transcript';
import { RecognitionLanguageToggle } from './recognition-language-toggle';

const ORB_SIZE = 150;

interface ListeningProps {
  state: VoiceCaptureState;
  level: SharedValue<number>;
  isQuiet: boolean;
  locale: SpeechLocale;
  onLocaleChange: (locale: SpeechLocale) => void;
  onFinish: () => void;
  onCancel: () => void;
  onResume: () => void;
  /** 들은 글자를 들고 말로 메모하기에서 이어 말한다 */
  onContinueAsVoiceNote: () => void;
}

/** 빠른 말하기 패널. 시트 안에서 입력 칸 대신 보이고, 높이는 화면 비율로 키운다 */
export function QuickVoicePanel(props: ListeningProps) {
  return <QuickVoicePanel.Listening {...props} />;
}

QuickVoicePanel.Listening = function Listening({
  state,
  level,
  isQuiet,
  locale,
  onLocaleChange,
  onFinish,
  onCancel,
  onResume,
  onContinueAsVoiceNote,
}: ListeningProps) {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const { height: windowHeight } = useWindowDimensions();
  const isPaused = state.status === 'paused';
  const isListening = state.status === 'listening';
  const isOverLimit = VoiceCapturePolicy.shouldOfferVoiceNote(state, Date.now());
  const canFinish = VoiceCapturePolicy.canFinish(state);
  const orbSize = Math.min(ORB_SIZE, windowHeight * 0.2);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{ minHeight: windowHeight * LISTENING_PANEL_HEIGHT_RATIO }}
      testID="quick-voice-listening"
    >
      <SheetEdgeGlow level={level} isActive={isListening} />
      <VStack flex={1} gap={12}>
        <HStack align="center" justify="between">
          <ListeningClock state={state} />
          <RecognitionLanguageToggle value={locale} onValueChange={onLocaleChange} />
        </HStack>

        <Box className="min-h-24 flex-1">
          <LiveTranscript transcript={state.transcript} />
        </Box>

        <VStack align="center" gap={8}>
          <VoiceOrb level={level} size={orbSize} isActive={isListening} />
          <Waveform level={level} isActive={isListening && !isQuiet} />
        </VStack>

        {isOverLimit ? (
          <VStack gap={8} testID="quick-voice-limit">
            <VStack gap={2}>
              <Text size="b3" weight="semibold" align="center" lineBreakStrategyIOS="hangul-word">
                {t('limit.title')}
              </Text>
              <Text size="b4" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
                {t('limit.description')}
              </Text>
            </VStack>
            <HStack gap={8} align="center">
              <CancelButton
                onPress={onCancel}
                label={t('listening.cancel')}
                iconSize={fontScaledSize(18)}
              />
              <PillButton
                label={t('limit.finish')}
                onPress={onFinish}
                isDisabled={!canFinish}
                testID="quick-voice-finish"
              />
            </HStack>
            <HStack>
              <PillButton
                label={t('limit.continueAsNote')}
                onPress={onContinueAsVoiceNote}
                isSecondary
                testID="quick-voice-continue-as-note"
              />
            </HStack>
          </VStack>
        ) : isPaused ? (
          <VStack gap={8}>
            <Text size="b4" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
              {t('listening.pausedHint')}
            </Text>
            <HStack gap={8} align="center">
              <CancelButton
                onPress={onCancel}
                label={t('listening.cancel')}
                iconSize={fontScaledSize(18)}
              />
              <PillButton
                label={t('listening.resume')}
                onPress={onResume}
                testID="quick-voice-resume"
              />
              {canFinish && (
                <PillButton
                  label={t('listening.done')}
                  onPress={onFinish}
                  isSecondary
                  testID="quick-voice-finish"
                />
              )}
            </HStack>
          </VStack>
        ) : (
          <VStack gap={8}>
            <HStack gap={8} align="center">
              <CancelButton
                onPress={onCancel}
                label={t('listening.cancel')}
                iconSize={fontScaledSize(18)}
              />
              <PillButton
                label={t('listening.done')}
                onPress={onFinish}
                isDisabled={!canFinish}
                fill={<SilenceFill isQuiet={isQuiet && canFinish} />}
                testID="quick-voice-finish"
              />
            </HStack>
            <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
              {t('listening.autoFinishHint')}
            </Text>
          </VStack>
        )}
      </VStack>
    </Animated.View>
  );
};

QuickVoicePanel.Planning = function Planning({
  state,
  onCancel,
}: {
  state: VoiceCaptureState;
  /** 정리를 그만두고 들은 글자를 입력 칸으로 옮긴다 */
  onCancel: () => void;
}) {
  const { t } = useTranslation('voice');
  const orbLevel = useSharedValue(0);
  const text = getTranscriptText(state.transcript);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      testID="quick-voice-planning"
    >
      <VStack gap={16}>
        <Text size="t3" weight="semibold" lineBreakStrategyIOS="hangul-word">
          {`“${text}”`}
        </Text>
        <HStack gap={10} align="center">
          <VoiceOrb level={orbLevel} size={32} isActive={false} />
          <Text size="b3" shade={6}>
            {t('planning.title')}
          </Text>
        </HStack>
        <QuickVoicePanel.CardsLoading />
        <TextButton
          size="small"
          className="self-center"
          onPress={onCancel}
          testID="quick-voice-planning-cancel"
        >
          {t('planning.cancel')}
        </TextButton>
      </VStack>
    </Animated.View>
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
  /** 카테고리를 고르지 못한 카드가 들어갈 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  onApplied: () => void;
  onRestart: () => void;
  onTypeInstead: () => void;
}

/** 계획을 고르는 단계. 이 단계가 떠 있는 동안 폼이 살아 있어 카드 시트를 오가거나 저장에 실패해도 고친 값이 남는다 */
QuickVoicePanel.Review = function Review({
  plan,
  isCharged,
  fallbackCategoryId,
  onApplied,
  onRestart,
  onTypeInstead,
}: ReviewProps) {
  const { t } = useTranslation('voice');
  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: createPlanReviewFormValues(plan),
    mode: 'onChange',
  });
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
        onApplied={onApplied}
      />
    </Animated.View>
  );
};

QuickVoicePanel.Failed = function Failed({
  state,
  isConsentRequired = false,
  onResume,
  onRetryPlanning,
}: {
  state: VoiceCaptureState;
  /** 정리가 AI 동의 때문에 막혔다. 다시 정리하면 동의 안내가 뜬다 */
  isConsentRequired?: boolean;
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
      className="rounded-xl bg-gray-2 px-3 py-2.5"
      testID="quick-voice-failed"
    >
      <Text size="b4" shade={7} className="flex-1 shrink" lineBreakStrategyIOS="hangul-word">
        {canRetryPlanning && isConsentRequired ? t('failed.consentRequired') : t('failed.keptText')}
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

function ListeningClock({ state }: { state: VoiceCaptureState }) {
  const [now, setNow] = useState(() => Date.now());
  const isListening = state.status === 'listening';

  useEffect(() => {
    if (!isListening) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), VOICE_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  return (
    <HStack gap={6} align="center">
      <Box className="size-2 rounded-full bg-main" />
      <Text size="b4" weight="semibold" shade={7} className="tabular-nums">
        {formatMediaTime(VoiceCapturePolicy.getElapsedMs(state, now))}
      </Text>
    </HStack>
  );
}

function CancelButton({
  onPress,
  label,
  iconSize,
}: {
  onPress: () => void;
  label: string;
  iconSize: number;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="size-12 items-center justify-center rounded-full bg-gray-2"
      testID="quick-voice-cancel"
    >
      <CloseIcon width={iconSize} height={iconSize} colorClassName="text-gray-7" />
    </PressableFeedback>
  );
}

interface PillButtonProps {
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  isSecondary?: boolean;
  fill?: React.ReactNode;
  testID?: string;
}

function PillButton({ label, onPress, isDisabled, isSecondary, fill, testID }: PillButtonProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityRole="button"
      testID={testID}
      className={
        isSecondary
          ? 'h-12 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-gray-2'
          : `h-12 flex-1 items-center justify-center overflow-hidden rounded-2xl ${isDisabled ? 'bg-gray-3' : 'bg-main'}`
      }
    >
      {fill}
      <Text size="b3" weight="semibold" tone={isSecondary ? 'neutral' : 'white'} maxLines={1}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

/** 말이 멈추면 버튼 안쪽이 차오르다가 가득 차면 자동으로 넘어간다 */
function SilenceFill({ isQuiet }: { isQuiet: boolean }) {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      isQuiet
        ? withTiming(1, {
            duration: isReducedMotion ? 0 : AUTO_FINISH_SILENCE_MS,
            easing: Easing.linear,
          })
        : 0,
    );
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
