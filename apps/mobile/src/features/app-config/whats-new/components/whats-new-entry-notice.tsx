import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, RobotPixelIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

type WhatsNewEntryNoticeProps = Omit<
  ComponentProps<typeof InlineAlert>,
  'image' | 'title' | 'description' | 'pressLabel' | 'closeLabel'
>;

export function WhatsNewEntryNotice(props: WhatsNewEntryNoticeProps) {
  const { t } = useTranslation('whatsNew');

  return (
    <InlineAlert
      image={<RobotPixelIcon width={24} height={24} colorClassName="text-main" />}
      title={t('entry.feedTitle')}
      description={t('entry.feedDescription')}
      pressLabel={t('entry.openLabel')}
      closeLabel={t('entry.dismissLabel')}
      {...props}
    />
  );
}
