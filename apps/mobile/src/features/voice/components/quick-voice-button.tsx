import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { IconButton, type IconButtonProps, MicIcon } from '@src/shared/ui';

type QuickVoiceButtonProps = Omit<
  IconButtonProps,
  'icon' | 'accessibilityLabel' | 'className' | 'style'
>;

export function QuickVoiceButton(pressableProps: QuickVoiceButtonProps) {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();

  return (
    <IconButton
      accessibilityLabel={t('button.label')}
      icon={
        <MicIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-main"
        />
      }
      hitSlop={4}
      {...pressableProps}
      className="size-9 min-h-0 min-w-0 rounded-full bg-main/10"
    />
  );
}
