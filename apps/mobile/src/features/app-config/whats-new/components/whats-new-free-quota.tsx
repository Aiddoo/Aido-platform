import { QuotaChip } from '@src/features/billing/subscription/components/quota-chip';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useFormatPlanValue } from '@src/features/billing/subscription/hooks/use-format-plan-value';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import {
  getPlanBenefitAmounts,
  toPlanFeatureComparison,
} from '@src/features/billing/subscription/utils/plan-benefit.view-model';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ReportDuoIcon,
  type StyledIcon,
  Text,
  TextSkeleton,
  VoiceDuoIcon,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';

const ICON_TILE_SIZE = 36;
const ICON_SIZE = 22;

export function WhatsNewFreeQuota() {
  const { t } = useTranslation(['whatsNew', 'subscription']);
  const { data: snapshot } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const formatPlanValue = useFormatPlanValue();
  const { free } = getPlanBenefitAmounts(snapshot);

  return (
    <VStack flex={1} gap={8} justify="center" className="rounded-3xl bg-highlight p-3">
      <FreeQuotaItem
        Icon={VoiceDuoIcon}
        label={t('subscription:quota.aiParse')}
        value={formatPlanValue(toPlanFeatureComparison(snapshot, 'AI_PARSE').free)}
        detail={t('subscription:quota.aiParseHint')}
        chip={<QuotaChip feature="AI_PARSE" className="self-start" />}
      />
      <FreeQuotaItem
        Icon={ReportDuoIcon}
        label={t('whatsNew:v1_15_0.quota.voiceNote')}
        value={formatPlanValue(toPlanFeatureComparison(snapshot, 'VOICE_NOTE').free)}
        detail={t('whatsNew:v1_15_0.quota.voiceNoteMinutes', { minutes: free.voiceNoteMinutes })}
        chip={<QuotaChip feature="VOICE_NOTE" className="self-start" />}
      />
      {EntitlementPolicy.hasFullAccess(snapshot) && (
        <Text size="b4" weight="semibold" tone="brand" align="center" className="pt-1">
          {t('whatsNew:v1_15_0.quota.fullAccess')}
        </Text>
      )}
    </VStack>
  );
}

interface FreeQuotaItemProps {
  Icon: StyledIcon;
  label: string;
  value: string;
  detail: string;
  chip: ReactNode;
}

function FreeQuotaItem({ Icon, label, value, detail, chip }: FreeQuotaItemProps) {
  const fontScaledSize = useFontScaledSize();

  return (
    <HStack gap={12} align="start" className="rounded-2xl bg-white p-4">
      <Box
        className="items-center justify-center rounded-[10px] bg-main/10"
        style={{ width: fontScaledSize(ICON_TILE_SIZE), height: fontScaledSize(ICON_TILE_SIZE) }}
      >
        <Icon
          width={fontScaledSize(ICON_SIZE)}
          height={fontScaledSize(ICON_SIZE)}
          colorClassName="text-main"
        />
      </Box>
      <VStack flex={1} gap={4}>
        <Text size="b4" weight="semibold" shade={7}>
          {label}
        </Text>
        <Text size="t3" weight="bold" className="tabular-nums">
          {value}
        </Text>
        <WordWrapText size="e1" shade={6}>
          {detail}
        </WordWrapText>
        {chip}
      </VStack>
    </HStack>
  );
}

WhatsNewFreeQuota.Loading = function Loading() {
  return (
    <VStack flex={1} gap={8} justify="center" className="rounded-3xl bg-highlight p-3">
      <FreeQuotaItem.Loading />
      <FreeQuotaItem.Loading />
    </VStack>
  );
};

FreeQuotaItem.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <HStack gap={12} align="start" className="rounded-2xl bg-white p-4">
      <Skeleton
        className="rounded-[10px]"
        style={{ width: fontScaledSize(ICON_TILE_SIZE), height: fontScaledSize(ICON_TILE_SIZE) }}
      />
      <VStack flex={1} gap={4}>
        <TextSkeleton size="b4" className="w-1/3" />
        <TextSkeleton size="t3" className="w-1/2" />
        <TextSkeleton size="e1" className="w-3/4" />
      </VStack>
    </HStack>
  );
};

WhatsNewFreeQuota.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <Box flex={1} className="justify-center rounded-3xl bg-highlight p-3">
      <QueryErrorFallback reset={reset} illustrationSize="block" />
    </Box>
  );
};
