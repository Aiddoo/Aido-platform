import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { Box, SheetScrollShadow, splitWords, Text } from '@src/shared/ui';
import { type ComponentRef, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';

import { VoiceTranscriptPolicy, type VoiceTranscript } from '../../domains/voice-transcript.model';

const MAX_ANIMATED_WORDS = 40;
const WORD_FADE_MS = 450;
const FOLLOW_THRESHOLD_PX = 24;

interface LiveTranscriptProps {
  transcript: VoiceTranscript;
  placeholder?: string;
  isWordFadeEnabled?: boolean;
}

/**
 * 자막. 글자가 늘면 최신 줄을 따라가고, 사용자가 위로 올리면 멈췄다가 끝까지 내리면 다시 따라간다.
 * 확정된 글자는 진하게(흐림→선명으로 한 단어씩), 인식 중인 꼬리는 회색으로 보여준다.
 * Android에는 한글을 단어 단위로 줄바꿈하는 Text prop이 없다(`lineBreakStrategyIOS`는 iOS 전용, RN은
 * `LineBreakConfig`를 노출하지 않는다). 그래서 단어마다 따로 그려 음절 사이에서 끊기지 않게 한다.
 */
export function LiveTranscript({
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
    <SheetScrollShadow className="flex-1">
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
    </SheetScrollShadow>
  );
}
