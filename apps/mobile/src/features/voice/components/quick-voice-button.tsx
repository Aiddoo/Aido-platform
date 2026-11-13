import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { MicIcon } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

type QuickVoiceButtonProps = Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'className' | 'style'
>;

export function QuickVoiceButton(pressableProps: QuickVoiceButtonProps) {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={t('button.label')}
      hitSlop={4}
      {...pressableProps}
      className="size-9 items-center justify-center rounded-full bg-main/10"
    >
      <MicIcon width={fontScaledSize(20)} height={fontScaledSize(20)} colorClassName="text-main" />
    </PressableFeedback>
  );
}
