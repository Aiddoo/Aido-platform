import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useEffect, useState } from 'react';
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
} from '../../constants/voice.constants';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../../domains/voice-capture.model';
import { getTranscriptText } from '../../domains/voice-transcript.model';
import { formatClock } from '../../utils/format-clock';
import { SheetEdgeGlow } from '../visualizers/sheet-edge-glow';
import { VoiceOrb } from '../visualizers/voice-orb';
import { Waveform } from '../visualizers/waveform';
import { LiveTranscript } from './live-transcript';
import { RecognitionLanguageToggle } from './recognition-language-toggle';

const ORB_SIZE = 150;
const CLOCK_TICK_MS = 1_000;

interface ListeningProps {
  state: VoiceCaptureState;
  level: SharedValue<number>;
  isQuiet: boolean;
  locale: SpeechLocale;
  onLocaleChange: (locale: SpeechLocale) => void;
  onFinish: () => void;
  onCancel: () => void;
  onResume: () => void;
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
}: ListeningProps) {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const { height: windowHeight } = useWindowDimensions();
  const isPaused = state.status === 'paused';
  const canFinish = VoiceCapturePolicy.canFinish(state);
  const orbSize = Math.min(ORB_SIZE, windowHeight * 0.2);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{ minHeight: windowHeight * LISTENING_PANEL_HEIGHT_RATIO }}
      testID="quick-voice-listening"
    >
      <SheetEdgeGlow level={level} />
      <VStack flex={1} gap={12}>
        <HStack align="center" justify="between">
          <ListeningClock state={state} />
          <RecognitionLanguageToggle value={locale} onValueChange={onLocaleChange} />
        </HStack>

        <Box className="min-h-24 flex-1">
          <LiveTranscript transcript={state.transcript} />
        </Box>

        <VStack align="center" gap={8}>
          <VoiceOrb level={level} size={orbSize} isActive={!isPaused} />
          <Waveform level={level} isActive={!isPaused && !isQuiet} />
        </VStack>

        {isPaused ? (
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

QuickVoicePanel.Planning = function Planning({ state }: { state: VoiceCaptureState }) {
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
        <VStack gap={8}>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </VStack>
      </VStack>
    </Animated.View>
  );
};

QuickVoicePanel.Failed = function Failed({
  state,
  onResume,
  onRetryPlanning,
}: {
  state: VoiceCaptureState;
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
        {t('failed.keptText')}
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
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  return (
    <HStack gap={6} align="center">
      <Box className="size-2 rounded-full bg-main" />
      <Text size="b4" weight="semibold" shade={7} className="tabular-nums">
        {formatClock(VoiceCapturePolicy.getElapsedMs(state, now))}
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
