import { FlashList } from '@shopify/flash-list';
import { useTranslation } from '@src/shared/i18n';
import { Box, FlagIcon, HStack, Text, WordWrapText } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import type { VoiceNoteSentence } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/media-time.view-model';
import { toCaptionTextParts } from '../../utils/voice-caption.view-model';

const AUTOSCROLL_THRESHOLD = 0.2;

type CaptionItem =
  | { type: 'sentence'; sentence: VoiceNoteSentence; index: number }
  | { type: 'interim'; text: string };

function CaptionSeparator() {
  return <Box className="h-2" />;
}

interface SentenceCaptionListProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  sentences: readonly VoiceNoteSentence[];
  interimText?: string;
  isLive?: boolean;
  activeSentenceIndex?: number;
  onPressSentence?: (sentence: VoiceNoteSentence) => void;
  contentBottomInset?: number;
}

export function SentenceCaptionList({
  sentences,
  interimText,
  isLive = false,
  activeSentenceIndex,
  onPressSentence,
  contentBottomInset = 0,
  ...boxProps
}: SentenceCaptionListProps) {
  const { t } = useTranslation('voiceNote');
  const items: CaptionItem[] = [
    ...sentences.map((sentence, index): CaptionItem => ({ type: 'sentence', sentence, index })),
    ...(interimText != null && interimText !== ''
      ? [{ type: 'interim', text: interimText } satisfies CaptionItem]
      : []),
  ];

  const hasLowConfidenceWords = sentences.some(
    ({ lowConfidenceWords }) => lowConfidenceWords.length > 0,
  );

  return (
    <Box {...boxProps}>
      {hasLowConfidenceWords && (
        <Text
          size="e1"
          shade={6}
          lineBreakStrategyIOS="hangul-word"
          className="mb-2"
          testID="caption-low-confidence-hint"
        >
          {t('captions.lowConfidenceHint')}
        </Text>
      )}
      <Box className="flex-1">
        <FlashList
          data={items}
          keyExtractor={(item) =>
            match(item)
              .with({ type: 'sentence' }, ({ sentence, index }) => `${index}:${sentence.startMs}`)
              .with({ type: 'interim' }, () => 'interim')
              .exhaustive()
          }
          getItemType={(item) => item.type}
          contentContainerStyle={{ paddingBottom: contentBottomInset }}
          maintainVisibleContentPosition={
            isLive
              ? {
                  autoscrollToBottomThreshold: AUTOSCROLL_THRESHOLD,
                  startRenderingFromBottom: true,
                }
              : undefined
          }
          ItemSeparatorComponent={CaptionSeparator}
          ListEmptyComponent={
            <Text size="b3" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
              {t('captions.empty')}
            </Text>
          }
          renderItem={({ item }) =>
            match(item)
              .with({ type: 'sentence' }, ({ sentence, index }) => (
                <SentenceCaptionList.Card
                  sentence={sentence}
                  isActive={index === activeSentenceIndex}
                  onPress={onPressSentence == null ? undefined : () => onPressSentence(sentence)}
                />
              ))
              .with({ type: 'interim' }, ({ text }) => (
                <Box className="rounded-xl bg-gray-1 px-3 py-3">
                  <WordWrapText size="b3" shade={5}>
                    {text}
                  </WordWrapText>
                </Box>
              ))
              .exhaustive()
          }
        />
      </Box>
    </Box>
  );
}

interface SentenceCardProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityLabel'
> {
  sentence: VoiceNoteSentence;
  isActive: boolean;
}

SentenceCaptionList.Card = function Card({
  sentence,
  isActive,
  onPress,
  className,
  ...pressableProps
}: SentenceCardProps) {
  const { t } = useTranslation('voiceNote');
  const time = formatMediaTime(sentence.startMs);

  return (
    <PressableFeedback
      accessibilityRole={onPress == null ? undefined : 'button'}
      accessibilityLabel={onPress == null ? undefined : t('captions.playFrom', { time })}
      isDisabled={onPress == null}
      onPress={onPress}
      className={cn(
        'rounded-xl bg-gray-1 px-3 py-3',
        sentence.isBookmarked && 'border-l-2 border-main',
        isActive && 'bg-main/10',
        className,
      )}
      {...pressableProps}
    >
      <HStack gap={8} className="items-start">
        <Text size="e1" shade={6} className="tabular-nums">
          {time}
        </Text>
        <WordWrapText size="b3" className="shrink flex-1">
          {toCaptionTextParts(sentence.text, sentence.lowConfidenceWords).map(
            ({ text, isLowConfidence }) => ({
              text,
              isUnderlined: isLowConfidence,
              testID: isLowConfidence ? 'caption-low-confidence-word' : undefined,
            }),
          )}
        </WordWrapText>
        {sentence.isBookmarked && (
          <FlagIcon
            colorClassName="text-main"
            width={14}
            height={14}
            accessibilityLabel={t('captions.marked')}
          />
        )}
      </HStack>
    </PressableFeedback>
  );
};
