import { useTranslation } from '@src/shared/i18n';
import { InlineNotice } from '@src/shared/ui';

import { useMarketingPushOptInPrompt } from '../hooks/use-marketing-push-opt-in-prompt';

interface MarketingPushOptInBannerProps {
  className?: string;
}

/** 광고성 앱 푸시 미동의자에게 feed에서 동의를 다시 권한다. 노출과 상호작용은 훅이 소유한다 */
export function MarketingPushOptInBanner({ className }: MarketingPushOptInBannerProps) {
  const { t } = useTranslation('notification');
  const { isVisible, open, dismiss } = useMarketingPushOptInPrompt();

  if (!isVisible) {
    return null;
  }

  return (
    <InlineNotice
      className={className}
      image={null}
      title={t('marketingOptIn.bannerTitle')}
      description={t('marketingOptIn.bannerDescription')}
      onPress={open}
      pressLabel={t('marketingOptIn.bannerTitle')}
      onClose={dismiss}
      closeLabel={t('marketingOptIn.bannerDismiss')}
    />
  );
}
