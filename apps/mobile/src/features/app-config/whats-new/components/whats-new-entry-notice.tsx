import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, RobotPixelIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

type WhatsNewEntryNoticeProps = Omit<
  ComponentProps<typeof InlineAlert>,
  'image' | 'title' | 'description' | 'pressLabel' | 'closeLabel'
>;

export function WhatsNewEntryNotice(props: WhatsNewEntryNoticeProps) {
  const { t } = useTranslation('whatsNew');
  const fontScaledSize = useFontScaledSize();

  return (
    <InlineAlert
      image={
        <RobotPixelIcon
          width={fontScaledSize(24)}
          height={fontScaledSize(24)}
          colorClassName="text-main"
        />
      }
      title={t('entry.feedTitle')}
      description={t('entry.feedDescription')}
      pressLabel={t('entry.openLabel')}
      closeLabel={t('entry.dismissLabel')}
      {...props}
    />
  );
}
