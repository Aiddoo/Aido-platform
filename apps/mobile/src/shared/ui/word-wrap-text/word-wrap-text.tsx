import type { ComponentProps } from 'react';

import { Box } from '../box/box';
import { Text } from '../text/text';
import { VStack } from '../v-stack/v-stack';
import { splitRunsIntoLines, splitRunsIntoWords, type TextRun } from './split-text-words';

interface WordWrapTextProps extends Omit<
  ComponentProps<typeof Text>,
  'children' | 'lineBreakStrategyIOS' | 'numberOfLines'
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

/** Android에는 단어 단위로 줄바꿈하는 Text prop이 없어(RN이 `LineBreakConfig`를 노출하지 않는다) 단어마다 따로 그린다. 뷰가 단어 수만큼 늘고 글자 선택이 안 되므로 가상화 목록의 문장이나 짧은 글에 쓴다 */
export function WordWrapText({ children, className, ...textProps }: WordWrapTextProps) {
  const runs: readonly TextRun[] = typeof children === 'string' ? [{ text: children }] : children;

  if (process.env.EXPO_OS !== 'android') {
    return (
      <Text {...textProps} className={className} lineBreakStrategyIOS="hangul-word">
        <WordRuns {...textProps} runs={runs} />
      </Text>
    );
  }

  return (
    <VStack
      className={className}
      accessible
      accessibilityLabel={runs.map(({ text }) => text).join('')}
    >
      {splitRunsIntoLines(runs).map((lineRuns, lineIndex) => {
        const words = splitRunsIntoWords(lineRuns);

        return (
          <Box key={lineIndex} className="flex-row flex-wrap">
            {words.length === 0 ? (
              // 빈 줄(문단 사이)은 단어가 없어 높이가 0이 되므로 공백 한 칸으로 줄 높이를 지킨다
              <Text {...textProps} className="max-w-full" importantForAccessibility="no">
                {' '}
              </Text>
            ) : (
              words.map((word, wordIndex) => (
                <Text
                  key={wordIndex}
                  {...textProps}
                  className="max-w-full"
                  importantForAccessibility="no"
                >
                  <WordRuns {...textProps} runs={word} />{' '}
                </Text>
              ))
            )}
          </Box>
        );
      })}
    </VStack>
  );
}
