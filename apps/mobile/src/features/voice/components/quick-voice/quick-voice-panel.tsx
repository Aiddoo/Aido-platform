import { zodResolver } from '@hookform/resolvers/zod';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Skeleton } from 'heroui-native';
import { type ReactNode, useEffect, useState } from 'react';
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
import { match } from 'ts-pattern';

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
import { isTranscriptEmpty } from '../../domains/voice-transcript.model';
import { formatMediaTime } from '../../utils/format-media-time';
import { VoiceNoteHeader } from '../note/voice-note-header';
import { RecognizerWaveform } from '../note/waveform-timeline';
import { PlanReview } from '../plan/plan-review';
import { VoiceOrb } from '../visualizers/voice-orb';
import { LiveTranscript } from './live-transcript';
import { RecognitionLanguageToggle } from './recognition-language-toggle';

const ORB_MAX_SIZE = 132;
const ORB_WINDOW_HEIGHT_RATIO = 0.16;

interface PanelFrameProps {
  center: ReactNode;
  right?: ReactNode;
  onClose: () => void;
  testID: string;
  children: ReactNode;
}

/** 듣기와 정리 중이 함께 쓰는 틀. 머리글 자리와 높이가 같아 상태가 바뀌어도 시트가 튀지 않는다 */
function PanelFrame({ center, right, onClose, testID, children }: PanelFrameProps) {
  const { t } = useTranslation('voice');
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{ minHeight: windowHeight * LISTENING_PANEL_HEIGHT_RATIO }}
      testID={testID}
    >
      <VStack flex={1} gap={16}>
        <VoiceNoteHeader
          center={center}
          right={right}
          onClose={onClose}
          closeLabel={t('listening.cancel')}
          closeTestID="quick-voice-cancel"
        />
        {children}
      </VStack>
    </Animated.View>
  );
}

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
  const { height: windowHeight } = useWindowDimensions();
  const isPaused = state.status === 'paused';
  const isListening = state.status === 'listening';
  const isOverLimit = VoiceCapturePolicy.shouldOfferVoiceNote(state, Date.now());
  const canFinish = VoiceCapturePolicy.canFinish(state);
  const orbSize = Math.min(ORB_MAX_SIZE, windowHeight * ORB_WINDOW_HEIGHT_RATIO);

  return (
    <PanelFrame
      center={<ListeningClock state={state} />}
      right={<RecognitionLanguageToggle value={locale} onValueChange={onLocaleChange} />}
      onClose={onCancel}
      testID="quick-voice-listening"
    >
      <Box className="min-h-24 flex-1">
        <LiveTranscript
          transcript={state.transcript}
          placeholder={isPaused ? undefined : t('listening.prompt')}
        />
      </Box>

      {!isOverLimit && (
        <VStack align="center" className={cn(isPaused && 'opacity-60')}>
          <VoiceOrb level={level} size={orbSize} isActive={isListening} />
          <RecognizerWaveform isActive={isListening} className="h-14 self-stretch" />
        </VStack>
      )}

      {isOverLimit ? (
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
      ) : isPaused ? (
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
      ) : (
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
      )}
    </PanelFrame>
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

  return (
    <PanelFrame
      center={
        <Text size="b4" weight="semibold" shade={7} maxLines={1}>
          {t('planning.title')}
        </Text>
      }
      onClose={onCancel}
      testID="quick-voice-planning"
    >
      <Box className="min-h-24 flex-1">
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
    </PanelFrame>
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
    <HStack gap={8} align="center">
      <Box className={cn('size-2 rounded-full', isListening ? 'bg-main' : 'bg-gray-4')} />
      <Text size="b4" weight="semibold" shade={7} className="tabular-nums">
        {formatMediaTime(VoiceCapturePolicy.getElapsedMs(state, now))}
      </Text>
    </HStack>
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
