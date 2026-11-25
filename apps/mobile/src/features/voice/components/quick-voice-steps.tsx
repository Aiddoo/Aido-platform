import { zodResolver } from '@hookform/resolvers/zod';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { ANIMATION } from '@src/shared/constants/animation';
import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  CloseIcon,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ScrollFade,
  splitWords,
  Text,
  TextButton,
  useKeyboardSheetBodyMaxHeight,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import { CloseButton, Skeleton } from 'heroui-native';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { FormState, useForm, Watch } from 'react-hook-form';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  AUTO_FINISH_SILENCE_MS,
  LISTENING_PANEL_HEIGHT,
  QUICK_CAPTURE_MAX_SECONDS,
} from '../constants/voice.constants';
import {
  createPlanReviewDraft,
  type SelectablePlannedAction,
} from '../domains/plan-review-draft.model';
import {
  VoiceCapturePolicy,
  type CapturedPlan,
  type VoiceCaptureState,
} from '../domains/voice-capture.model';
import { VoiceTranscriptPolicy, type VoiceTranscript } from '../domains/voice-transcript.model';
import { useCaptureElapsedMs } from '../hooks/use-capture-elapsed-ms';
import { usePlanApply } from '../hooks/use-plan-apply';
import { planReviewFormSchema } from '../schemas/plan-review-form.schema';
import { formatMediaTime } from '../utils/media-time.view-model';
import { PlanReview } from './plan-review';
import { RecognitionLanguageTabs } from './recognition-language-tabs';
import { VoiceVisual } from './voice-visual';

const MAX_ANIMATED_WORDS = 40;
const WORD_FADE_MS = 450;
const FOLLOW_THRESHOLD_PX = 24;

interface QuickVoiceListeningProps {
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

export function QuickVoiceListening({
  state,
  level,
  isQuiet,
  locale,
  onLocaleChange,
  onFinish,
  onCancel,
  onResume,
  onContinueAsVoiceNote,
}: QuickVoiceListeningProps) {
  const { t } = useTranslation('voice');
  const isPaused = state.status === 'paused';
  const isListening = state.status === 'listening';
  const isOverLimit = VoiceCapturePolicy.shouldOfferVoiceNote(state, QUICK_CAPTURE_MAX_SECONDS);
  const canFinish = VoiceCapturePolicy.canFinish(state);

  return (
    <CaptureLayout
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
          <VoiceVisual level={level} isActive={isListening} className="self-stretch" />
        </Box>
      )}

      {match({ isOverLimit, canFinish, isPaused })
        .with({ isOverLimit: true, canFinish: true }, () => (
          <VStack gap={8} testID="quick-voice-limit">
            <LimitMessage title={t('limit.title')} description={t('limit.description')} />
            <Button size="large" onPress={onFinish} testID="quick-voice-finish">
              {t('limit.finish')}
            </Button>
            <Button
              size="large"
              variant="weak"
              color="dark"
              onPress={onContinueAsVoiceNote}
              testID="quick-voice-continue-as-note"
            >
              {t('limit.continueAsNote')}
            </Button>
          </VStack>
        ))
        .with({ isOverLimit: true, canFinish: false }, () => (
          <VStack gap={8} testID="quick-voice-limit">
            <LimitMessage title={t('limit.titleEmpty')} description={t('limit.descriptionEmpty')} />
            <Button
              size="large"
              onPress={onContinueAsVoiceNote}
              testID="quick-voice-continue-as-note"
            >
              {t('limit.continueAsNote')}
            </Button>
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
    </CaptureLayout>
  );
}

export function QuickVoicePlanning({
  transcript,
  onCancel,
}: {
  transcript: VoiceTranscript;
  onCancel: () => void;
}) {
  const { t } = useTranslation('voice');

  return (
    <CaptureLayout
      center={
        <Text size="b4" weight="semibold" shade={7} numberOfLines={1}>
          {t('planning.title')}
        </Text>
      }
      onClose={onCancel}
      testID="quick-voice-planning"
    >
      <Box flex={1}>
        <LiveTranscript transcript={transcript} isWordFadeEnabled={false} />
      </Box>
      <QuickVoiceReview.Loading />
      <TextButton
        size="small"
        className="self-center"
        onPress={onCancel}
        testID="quick-voice-planning-cancel"
      >
        {t('planning.cancel')}
      </TextButton>
    </CaptureLayout>
  );
}

interface ReviewProps extends CapturedPlan {
  fallbackCategoryId: number;
  onMemoChanged: () => void;
  onApplied: () => void;
  onRestart: () => void;
  onTypeInstead: () => void;
}

/** 계획을 고르는 단계. 이 단계가 떠 있는 동안 폼이 살아 있어 카드 시트를 오가거나 저장에 실패해도 고친 값이 남는다 */
export function QuickVoiceReview({
  plan,
  isCharged,
  fallbackCategoryId,
  onMemoChanged,
  onApplied,
  onRestart,
  onTypeInstead,
}: ReviewProps) {
  const { t } = useTranslation('voice');
  const reportUnexpectedError = useReportUnexpectedError('voice');
  const form = useForm({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: createPlanReviewDraft(plan).form,
    mode: 'onChange',
  });
  const bodyMaxHeight = useKeyboardSheetBodyMaxHeight();
  const planApply = usePlanApply({ plan, fallbackCategoryId, onMemoChanged, onApplied });

  // 고친 카드의 자리만 쓴다. 배열을 통째로 바꾸면 그 사이 다른 카드에 생긴 변경을 덮는다
  const changeAction = (index: number, action: SelectablePlannedAction) =>
    form.setValue(`actions.${index}`, action, { shouldDirty: true, shouldValidate: true });

  const savePlan = form.handleSubmit(({ actions }) => planApply.apply(actions));
  // 저장 중 표시는 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 같은 계획을 한 번 더 보낸다
  const handleSavePress = useSingleTap(() => {
    savePlan().catch(reportUnexpectedError);
  });

  const restartButton = (
    <Box className="flex-1">
      <Button variant="weak" color="dark" onPress={onRestart} testID="quick-voice-restart">
        {t('review.restart')}
      </Button>
    </Box>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.durationMs.normal)}
      testID="quick-voice-review"
    >
      <FormState
        control={form.control}
        render={({ isValid }) => (
          <Watch
            control={form.control}
            name="actions"
            render={(actions) => (
              <PlanReview
                surface="sheet"
                style={{ maxHeight: bodyMaxHeight }}
                value={actions}
                onItemChange={changeAction}
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
                isValid={isValid}
                isApplying={planApply.isPending || planApply.isApplied}
                onApplyPress={handleSavePress}
              />
            )}
          />
        )}
      />
    </Animated.View>
  );
}

/** 계획을 받기 전 카드 자리. 정리를 기다리는 동안과 카드가 쓰는 조회를 기다리는 동안 같은 모양이다 */
QuickVoiceReview.Loading = function Loading() {
  return (
    <VStack gap={8}>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </VStack>
  );
};

QuickVoiceReview.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

export function QuickVoiceFailed({
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
            ({ transcript }) => VoiceTranscriptPolicy.isTranscriptEmpty(transcript),
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
}

function LimitMessage({ title, description }: { title: string; description: string }) {
  return (
    <VStack gap={4}>
      <Text size="b3" weight="semibold" align="center" lineBreakStrategyIOS="hangul-word">
        {title}
      </Text>
      <Text size="b4" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
        {description}
      </Text>
    </VStack>
  );
}

interface CaptureLayoutProps {
  center: ReactNode;
  right?: ReactNode;
  onClose: () => void;
  testID: string;
  children: ReactNode;
}

/** 듣기·정리 단계의 시트. 높이를 고정해야 긴 자막이 시트를 키워 조작을 화면 밖으로 밀지 않는다(QA: 93초 발화) */
function CaptureLayout({ center, right, onClose, testID, children }: CaptureLayoutProps) {
  const { height: windowHeight } = useAppWindow();
  const bodyMaxHeight = useKeyboardSheetBodyMaxHeight();
  const height = clamp(
    windowHeight * LISTENING_PANEL_HEIGHT.windowRatio,
    LISTENING_PANEL_HEIGHT.min,
    bodyMaxHeight,
  );

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.durationMs.normal)}
      exiting={FadeOut.duration(ANIMATION.durationMs.fast)}
      style={{ height }}
      testID={testID}
    >
      <VStack flex={1} gap={16}>
        <CaptureLayout.Header center={center} right={right} onClose={onClose} />
        {children}
      </VStack>
    </Animated.View>
  );
}

type CaptureLayoutHeaderProps = Pick<CaptureLayoutProps, 'center' | 'right' | 'onClose'>;

/** 시트라 네이티브 헤더가 없다. 좁은 창은 오른쪽이 넓어 가운데를 남는 자리의 가운데에 둔다 */
CaptureLayout.Header = function Header({ center, right, onClose }: CaptureLayoutHeaderProps) {
  const { t } = useTranslation(['voice', 'common']);
  const fontScaledSize = useFontScaledSize();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <HStack align="center" gap={8}>
      <Box flex={isCompact ? undefined : 1} className="items-start">
        <CloseButton
          variant="ghost"
          className="size-[22px]"
          hitSlop={11}
          onPress={onClose}
          aria-label={t('common:actions.cancel')}
          testID="quick-voice-cancel"
        >
          <CloseIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-7"
          />
        </CloseButton>
      </Box>
      <Box flex={isCompact ? 1 : undefined} className="items-center">
        {center}
      </Box>
      <Box flex={isCompact ? undefined : 1} className="shrink items-end">
        {right}
      </Box>
    </HStack>
  );
};

interface LiveTranscriptProps {
  transcript: VoiceTranscript;
  placeholder?: string;
  isWordFadeEnabled?: boolean;
}

/** 위로 올리면 따라가기를 멈추고 끝까지 내리면 다시 따른다. Android는 한글 단어 줄바꿈 prop이 없어 단어마다 그린다 */
function LiveTranscript({
  transcript,
  placeholder,
  isWordFadeEnabled = true,
}: LiveTranscriptProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isReducedMotion = useIsReduceMotionEnabled();
  const isFollowingRef = useRef(true);
  const finalText = VoiceTranscriptPolicy.getFinalText(transcript);
  const finalWords = splitWords(finalText);
  const interimWords = splitWords(transcript.interim);
  const isAnimated =
    isWordFadeEnabled && !isReducedMotion && finalWords.length <= MAX_ANIMATED_WORDS;
  const isEmpty = finalWords.length === 0 && interimWords.length === 0;

  const scrollToLatest = () => {
    if (isFollowingRef.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  };

  const followIfAtEnd = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    isFollowingRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - FOLLOW_THRESHOLD_PX;
  };

  return (
    <ScrollFade surface="sheet" className="flex-1">
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={scrollToLatest}
        onLayout={scrollToLatest}
        onScrollBeginDrag={() => {
          isFollowingRef.current = false;
        }}
        onScrollEndDrag={followIfAtEnd}
        onMomentumScrollEnd={followIfAtEnd}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        testID="live-transcript"
      >
        <Box className="flex-row flex-wrap">
          {isEmpty && placeholder != null && (
            <Text size="t2" weight="semibold" shade={4} lineBreakStrategyIOS="hangul-word">
              {placeholder}
            </Text>
          )}
          {finalWords.map((word, index) =>
            isAnimated ? (
              <Animated.View key={`${index}-${word}`} entering={FadeIn.duration(WORD_FADE_MS)}>
                <Text size="t2" weight="semibold" lineBreakStrategyIOS="hangul-word">
                  {`${word} `}
                </Text>
              </Animated.View>
            ) : (
              <Text
                key={`${index}-${word}`}
                size="t2"
                weight="semibold"
                lineBreakStrategyIOS="hangul-word"
              >
                {`${word} `}
              </Text>
            ),
          )}
          {interimWords.map((word, index) => (
            <Text
              key={`interim-${index}-${word}`}
              size="t2"
              weight="semibold"
              shade={5}
              lineBreakStrategyIOS="hangul-word"
            >
              {`${word} `}
            </Text>
          ))}
        </Box>
      </ScrollView>
    </ScrollFade>
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
  const isReducedMotion = useIsReduceMotionEnabled();
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
