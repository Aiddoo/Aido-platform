import { Box, Text } from '@src/shared/ui';
import { type ComponentRef, useRef } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import {
  getFinalText,
  getInterimText,
  type VoiceTranscript,
} from '../../domains/voice-transcript.model';

/** 이 개수를 넘으면 단어를 하나씩 등장시키지 않는다 */
const MAX_ANIMATED_WORDS = 40;
const WORD_FADE_MS = 450;

const splitWords = (text: string) => text.split(' ').filter((word) => word.length > 0);

interface LiveTranscriptProps {
  transcript: VoiceTranscript;
}

/**
 * 확정된 글자는 진하게(흐림→선명으로 한 단어씩), 인식 중인 꼬리는 회색으로 보여준다.
 * Android에는 한글을 단어 단위로 줄바꿈하는 Text prop이 없다(`lineBreakStrategyIOS`는 iOS 전용, RN은
 * `LineBreakConfig`를 노출하지 않는다). 그래서 단어마다 따로 그려 음절 사이에서 끊기지 않게 한다.
 */
export function LiveTranscript({ transcript }: LiveTranscriptProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isReducedMotion = useReducedMotion();
  const finalWords = splitWords(getFinalText(transcript));
  const interimWords = splitWords(getInterimText(transcript));
  const isAnimated = !isReducedMotion && finalWords.length <= MAX_ANIMATED_WORDS;

  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      showsVerticalScrollIndicator={false}
      testID="live-transcript"
    >
      <Box className="flex-row flex-wrap">
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
  );
}
