import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { Box } from '../box';
import { Text } from '../text';
import { VStack } from '../v-stack';
import { splitRunsIntoWords, type TextRun } from './split-text-words';

interface WordWrapTextProps extends Omit<
  ComponentProps<typeof Text>,
  'children' | 'lineBreakStrategyIOS' | 'maxLines'
> {
  children: string | readonly TextRun[];
}

function WordRuns({
  runs,
  ...textProps
}: { runs: readonly TextRun[] } & ComponentProps<typeof Text>) {
  return runs.map(({ text, isUnderlined, testID }, index) =>
    isUnderlined === true ? (
      <Text key={index} {...textProps} underline testID={testID}>
        {text}
      </Text>
    ) : (
      text
    ),
  );
}

/**
 * 한글이 음절 사이에서 끊기지 않는 긴 글. Android에는 단어 단위로 줄바꿈하는 Text prop이 없어(RN이 `LineBreakConfig`를
 * 노출하지 않는다) 단어마다 따로 그린다. iOS는 `lineBreakStrategyIOS`를 쓰는 Text 하나다.
 * 뷰가 단어 수만큼 늘고 글자 선택이 안 되므로 가상화 목록의 문장이나 짧은 글에 쓴다.
 */
export function WordWrapText({ children, className, ...textProps }: WordWrapTextProps) {
  const runs: readonly TextRun[] = typeof children === 'string' ? [{ text: children }] : children;

  if (Platform.OS !== 'android') {
    return (
      <Text {...textProps} className={className} lineBreakStrategyIOS="hangul-word">
        <WordRuns {...textProps} runs={runs} />
      </Text>
    );
  }

  const lines = runs.flatMap((run) =>
    run.text.split('\n').map((text): TextRun => ({ ...run, text })),
  );
  const hasLineBreak = lines.length > runs.length;

  return (
    <VStack
      className={className}
      accessible
      accessibilityLabel={runs.map(({ text }) => text).join('')}
    >
      {(hasLineBreak ? lines.map((line) => [line]) : [runs]).map((lineRuns, lineIndex) => (
        <Box key={lineIndex} className="flex-row flex-wrap">
          {splitRunsIntoWords(lineRuns).map((word, wordIndex) => (
            <Text
              key={wordIndex}
              {...textProps}
              className="max-w-full"
              importantForAccessibility="no"
            >
              <WordRuns {...textProps} runs={word} />{' '}
            </Text>
          ))}
        </Box>
      ))}
    </VStack>
  );
}
