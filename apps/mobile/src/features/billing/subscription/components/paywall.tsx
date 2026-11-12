import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { Trans, useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { H2, Text, VStack } from '@src/shared/ui';

import {
  findSubscriptionStore,
  type RenewalNoticeStore,
} from '../utils/subscription-store.view-model';
import { BlockedFeature } from './blocked-feature';

export function Paywall() {
  const { t } = useTranslation('subscription');

  return (
    <VStack gap={4} align="center">
      <H2>{t('paywall.title')}</H2>

      <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
        {t('paywall.subtitle')}
      </Text>
    </VStack>
  );
}

/** 혜택 장에 없는 기능에서 막혀 들어왔을 때 그 기능을 요금제보다 먼저 보여 준다. 혜택 장에 있으면 넘기기가 그 장부터 보여 준다 */

Paywall.BlockedFeature = BlockedFeature;

const RENEWAL_NOTICE_KEYS = {
  appStore: 'paywall.renewalNotice.appStore',
  googlePlay: 'paywall.renewalNotice.googlePlay',
} as const satisfies Record<RenewalNoticeStore, string>;

Paywall.RenewalNotice = function RenewalNotice() {
  const { t } = useTranslation('subscription');
  const store = findSubscriptionStore(process.env.EXPO_OS);

  if (store == null) {
    return null;
  }

  return (
    <Text size="e2" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
      {t(RENEWAL_NOTICE_KEYS[store])}
    </Text>
  );
};

Paywall.Terms = function Terms() {
  const { t } = useTranslation('subscription');
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();

  return (
    <Text size="e2" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
      <Trans
        t={t}
        i18nKey="paywall.terms"
        components={{
          terms: (
            <Text
              size="e2"
              shade={5}
              underline
              onPress={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
            />
          ),
          privacy: (
            <Text
              size="e2"
              shade={5}
              underline
              onPress={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
            />
          ),
        }}
      />
    </Text>
  );
};
