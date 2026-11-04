import { Text } from '@src/shared/ui';
import { type ComponentRef, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import {
  getFinalText,
  getInterimText,
  type VoiceTranscript,
} from '../../domains/voice-transcript.model';

/** 이 개수를 넘으면 단어 하나씩 등장시키지 않고 한 덩어리로 그린다 */
const MAX_ANIMATED_WORDS = 40;
const WORD_FADE_MS = 450;

interface LiveTranscriptProps {
  transcript: VoiceTranscript;
}

/** 확정된 글자는 진하게(흐림→선명으로 한 단어씩), 인식 중인 꼬리는 회색으로 보여준다 */
export function LiveTranscript({ transcript }: LiveTranscriptProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const isReducedMotion = useReducedMotion();
  const finalWords = getFinalText(transcript)
    .split(' ')
    .filter((word) => word.length > 0);
  const interim = getInterimText(transcript);
  const isAnimated = !isReducedMotion && finalWords.length <= MAX_ANIMATED_WORDS;

  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      showsVerticalScrollIndicator={false}
      testID="live-transcript"
    >
      {isAnimated ? (
        <View className="flex-row flex-wrap">
          {finalWords.map((word, index) => (
            <Animated.View key={`${index}-${word}`} entering={FadeIn.duration(WORD_FADE_MS)}>
              <Text size="t2" weight="semibold" lineBreakStrategyIOS="hangul-word">
                {`${word} `}
              </Text>
            </Animated.View>
          ))}
          {interim.length > 0 && (
            <Text size="t2" weight="semibold" shade={5} lineBreakStrategyIOS="hangul-word">
              {interim}
            </Text>
          )}
        </View>
      ) : (
        <Text size="t2" weight="semibold" lineBreakStrategyIOS="hangul-word">
          {finalWords.join(' ')}
          {interim.length > 0 && (
            <Text size="t2" weight="semibold" shade={5} lineBreakStrategyIOS="hangul-word">
              {` ${interim}`}
            </Text>
          )}
        </Text>
      )}
    </ScrollView>
  );
}
