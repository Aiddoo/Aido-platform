import { useTranslation } from '@src/shared/i18n';
import { InlineNotice, RobotPixelIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

type WhatsNewEntryCardProps = Pick<ComponentProps<typeof InlineNotice>, 'onPress' | 'onClose'>;

/** 새로운 기능을 다시 여는 피드 카드 */
export function WhatsNewEntryCard(props: WhatsNewEntryCardProps) {
  const { t } = useTranslation('whatsNew');

  return (
    <InlineNotice
      image={<RobotPixelIcon width={24} height={24} colorClassName="text-main" />}
      title={t('entry.feedTitle')}
      description={t('entry.feedDescription')}
      pressLabel={t('entry.openLabel')}
      closeLabel={t('entry.dismissLabel')}
      {...props}
    />
  );
}
