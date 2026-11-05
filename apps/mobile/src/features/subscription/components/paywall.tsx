import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { legalUrl } from '@src/shared/constants/legal-urls';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  Box,
  CalendarIcon,
  DashedDivider,
  DocsIcon,
  H2,
  HStack,
  ListIcon,
  MicIcon,
  PersonIcon,
  Spacing,
  type StyledIconType,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Image, type ImageSourcePropType, Platform } from 'react-native';

import { useGetEntitlementsQueryOptions } from '../queries/get-entitlements-query-options';
import { getSubscriptionStore, type SubscriptionStore } from '../utils/subscription-store';
import { toPlanBenefitAmounts } from '../utils/view-models/plan-benefit.view-model';

/** 스토어 응답 없이 그리는 제목과 혜택. 요금제를 못 받아도 늘 같은 자리에 보인다 */
export function Paywall() {
  const { t } = useTranslation('subscription');

  return (
    <Box className="px-5 pt-5">
      <VStack gap={4} className="items-center">
        <H2>{t('paywall.title')}</H2>

        <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('paywall.subtitle')}
        </Text>
      </VStack>

      <DashedDivider className="my-6" />

      <Paywall.Benefits />

      <Spacing size={20} />

      <Paywall.AdditionalBenefits />

      <Spacing size={8} />

      <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('paywall.futureIncluded')}
      </Text>
    </Box>
  );
}

/** 그림과 함께 보여 주는 대표 혜택. 숫자는 서버 스냅샷(무료)과 PLAN_CATALOG(프리미엄)에서 읽는다 */
Paywall.Benefits = function Benefits() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = toPlanBenefitAmounts(entitlements);
  const formatAmount = (value: number) => formatCount(value, locale);

  return (
    <VStack gap={20}>
      <BenefitCard
        title={t('benefits.aiParsing.title')}
        description={t('benefits.aiParsing.description', {
          free: formatAmount(free.aiParse),
          premium: formatAmount(premium.aiParse),
        })}
        image={benefitAiParsingImage}
      />
      <BenefitCard
        title={t('benefits.nudge.title')}
        description={t('benefits.nudge.description', { free: formatAmount(free.nudge) })}
        image={benefitNudgeImage}
      />
      <BenefitCard
        title={t('benefits.reminder.title')}
        description={t('benefits.reminder.description')}
        image={benefitNotificationImage}
      />
      <BenefitCard
        title={t('benefits.appIcon.title')}
        description={t('benefits.appIcon.description')}
        image={benefitAppIconImage}
      />
    </VStack>
  );
};

Paywall.AdditionalBenefits = function AdditionalBenefits() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = toPlanBenefitAmounts(entitlements);
  const formatAmount = (value: number) => formatCount(value, locale);

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('paywall.moreBenefits')}
      </Text>

      <AdditionalBenefit
        Icon={MicIcon}
        title={t('benefits.voiceNote.title', {
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        })}
        description={t('benefits.voiceNote.description', {
          free: formatAmount(free.voiceNote),
          freeMinutes: formatAmount(free.voiceNoteMinutes),
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={PersonIcon}
        title={t('benefits.friends.title')}
        description={t('benefits.friends.description', { free: formatAmount(free.friend) })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={ListIcon}
        title={t('benefits.categories.title', { premium: formatAmount(premium.category) })}
        description={t('benefits.categories.description', {
          free: formatAmount(free.category),
          premium: formatAmount(premium.category),
        })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={CalendarIcon}
        title={t('benefits.aiRepeat.title')}
        description={t('benefits.aiRepeat.description')}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={DocsIcon}
        title={t('benefits.aiReport.title')}
        description={t('benefits.aiReport.description')}
      />
    </VStack>
  );
};

const RENEWAL_NOTICE_KEYS = {
  appStore: 'paywall.renewalNotice.appStore',
  googlePlay: 'paywall.renewalNotice.googlePlay',
} as const satisfies Record<SubscriptionStore, string>;

Paywall.RenewalNotice = function RenewalNotice() {
  const { t } = useTranslation('subscription');
  const store = getSubscriptionStore(Platform.OS);

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
  const openUrl = useOpenUrl();
  const { resolvedLanguage } = useLanguage();

  return (
    <Text size="e2" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
      {t('paywall.termsPrefix')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(legalUrl('terms', resolvedLanguage))}
      >
        {t('paywall.termsLink')}
      </Text>
      {t('paywall.termsAnd')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(legalUrl('privacy', resolvedLanguage))}
      >
        {t('paywall.privacyLink')}
      </Text>
      {t('paywall.termsSuffix')}
    </Text>
  );
};

interface BenefitCardProps {
  title: string;
  description: string;
  image: ImageSourcePropType;
}

function BenefitCard({ title, description, image }: BenefitCardProps) {
  return (
    <VStack gap={12}>
      <VStack className="flex-1">
        <Text size="b3" weight="semibold" shade={9} lineBreakStrategyIOS="hangul-word">
          {title}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {description}
        </Text>
      </VStack>

      <Box className="w-full aspect-video rounded-xl overflow-hidden">
        <Image source={image} className="size-full" resizeMode="cover" />
      </Box>
    </VStack>
  );
}

interface AdditionalBenefitProps {
  Icon: StyledIconType;
  title: string;
  description: string;
}

function AdditionalBenefit({ Icon, title, description }: AdditionalBenefitProps) {
  return (
    <HStack gap={12} className="items-center">
      <Box className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
        <Icon width={20} height={20} colorClassName="text-main" />
      </Box>

      <VStack gap={2} className="flex-1">
        <Text size="b3" weight="bold" shade={9} lineBreakStrategyIOS="hangul-word">
          {title}
        </Text>

        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {description}
        </Text>
      </VStack>
    </HStack>
  );
}
