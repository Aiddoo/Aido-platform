import { FlashList } from '@shopify/flash-list';
import { useTranslation } from '@src/shared/i18n';
import { Box, FlagIcon, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import type { VoiceNoteSentence } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/format-media-time';

const AUTOSCROLL_THRESHOLD = 0.2;

type CaptionItem =
  | { type: 'sentence'; sentence: VoiceNoteSentence; index: number }
  | { type: 'interim'; text: string };

interface SentenceCaptionListProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  /** 확정된 문장. 길어져도 보이는 만큼만 그리는 가상화 목록이다 */
  sentences: readonly VoiceNoteSentence[];
  /** 아직 인식 중인 꼬리. 확정되기 전이라 회색으로 그린다 */
  interimText?: string;
  /** 녹음 중이면 아래부터 쌓이며 따라 내려가고, 사용자가 위로 올리면 멈춘다 */
  isLive?: boolean;
  /** 재생 위치가 속한 문장 */
  activeSentenceIndex?: number;
  /** 주면 문장을 눌러 그 시각부터 들을 수 있다 */
  onPressSentence?: (sentence: VoiceNoteSentence) => void;
}

/** 문장 카드 자막. 녹음 중에는 아래로 쌓이고 사용자가 위로 올리면 자동 스크롤이 멈춘다 */
export function SentenceCaptionList({
  sentences,
  interimText,
  isLive = false,
  activeSentenceIndex,
  onPressSentence,
  ...boxProps
}: SentenceCaptionListProps) {
  const { t } = useTranslation('voiceNote');
  const items: CaptionItem[] = [
    ...sentences.map((sentence, index): CaptionItem => ({ type: 'sentence', sentence, index })),
    ...(interimText != null && interimText !== ''
      ? [{ type: 'interim', text: interimText } satisfies CaptionItem]
      : []),
  ];

  return (
    <Box {...boxProps}>
      <FlashList
        data={items}
        keyExtractor={(item) =>
          match(item)
            .with({ type: 'sentence' }, ({ sentence, index }) => `${index}:${sentence.startMs}`)
            .with({ type: 'interim' }, () => 'interim')
            .exhaustive()
        }
        getItemType={(item) => item.type}
        maintainVisibleContentPosition={
          isLive
            ? { autoscrollToBottomThreshold: AUTOSCROLL_THRESHOLD, startRenderingFromBottom: true }
            : undefined
        }
        ItemSeparatorComponent={() => <Box className="h-2" />}
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
              <Box className="rounded-xl bg-gray-1 px-3 py-2.5">
                <Text size="b3" shade={5} lineBreakStrategyIOS="hangul-word">
                  {text}
                </Text>
              </Box>
            ))
            .exhaustive()
        }
      />
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

function SentenceCard({
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
        'rounded-xl bg-gray-1 px-3 py-2.5',
        sentence.isBookmarked && 'border-l-[3px] border-main',
        isActive && 'bg-main/10',
        className,
      )}
      {...pressableProps}
    >
      <HStack gap={6} className="items-start">
        <Text size="e1" shade={6} className="mt-0.5 tabular-nums">
          {time}
        </Text>
        <Text size="b3" lineBreakStrategyIOS="hangul-word" className="shrink flex-1">
          {sentence.text}
        </Text>
        {sentence.isBookmarked && (
          <FlagIcon
            colorClassName="accent-main"
            width={14}
            height={14}
            accessibilityLabel={t('captions.marked')}
          />
        )}
      </HStack>
    </PressableFeedback>
  );
}

SentenceCaptionList.Card = SentenceCard;
