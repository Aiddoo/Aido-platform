import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { Box, ScrollFade, splitWords, Text } from '@src/shared/ui';
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

/** 위로 올리면 따라가기를 멈추고 끝까지 내리면 다시 따른다. Android는 한글 단어 줄바꿈 prop이 없어 단어마다 그린다 */
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
