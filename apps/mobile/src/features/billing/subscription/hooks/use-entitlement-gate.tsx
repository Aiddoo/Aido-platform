import type {
  PlanFlagFeatureKey,
  PlanHorizonFeatureKey,
  PlanLimitFeatureKey,
} from '@aido/api/vocabulary';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import {
  ArrowRightIcon,
  Button,
  H4,
  HStack,
  Meter,
  QueryErrorBoundary,
  QueryErrorFallback,
  SurfaceCard,
  Text,
  TextButton,
  useAppToast,
  useOpenSheet,
  VStack,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';
import { match } from 'ts-pattern';

import { parseLimitedFeature } from '../apis/entitlement.mapper';
import { PremiumFeatureIcon } from '../components/premium-feature-icon';
import type { EntitlementGateSurface, LimitReachedTrigger } from '../constants/subscription.events';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { type EntitlementFeature } from '../domains/feature-quota.model';
import { LimitedFeaturePolicy } from '../domains/limited-feature.model';
import { getCachedEntitlements, reflectFeatureQuota } from '../queries/entitlement-cache';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { upsellDismissalStoredValue } from '../schemas/upsell-dismissal-storage.schema';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';
import { getUpsellPresentation, type UpsellPresentation } from '../utils/upsell.view-model';
import { useFormatPlanValue } from './use-format-plan-value';
import { useFormatRefillSentence } from './use-format-refill-sentence';
import { useQuotaStatus } from './use-quota-status';

type BlockedDecision = 'limit-reached' | 'locked';

type UpsellChoice = 'subscribe' | 'alternative' | 'dismiss';

type EntitlementGatePromptOptions = Partial<
  Pick<ComponentProps<typeof PremiumUpsell>, 'title' | 'description'> &
    Pick<ComponentProps<typeof PremiumUpsell.Actions>, 'alternativeAction'>
> & {
  /** 프리미엄 보기를 고르면 페이월로 가기 전에 불린다(아래 시트를 닫는 등) */
  onSubscribe?: () => void;
  /** 안내를 마치면 한 번 불린다. 시트는 답을 고른 바로 뒤(페이월·대안으로 가기 전), 토스트는 띄운 바로 뒤다(안내만 보이고 떠나는 시트 route) */
  onFinish?: () => void;
};

const GATE_TITLE_KEYS = {
  AI_PARSE: 'gate.aiParseTitle',
  VOICE_NOTE: 'gate.voiceNoteTitle',
  NUDGE: 'gate.nudgeTitle',
  CHEER: 'gate.cheerTitle',
  FRIEND: 'gate.friendTitle',
  TODO_CATEGORY: 'gate.categoryTitle',
  AI_REPORT: 'gate.aiReportTitle',
  AI_SUGGESTION: 'gate.aiSuggestionTitle',
  CUSTOM_REMINDER_TIME: 'gate.reminderTimeTitle',
  APP_ICON: 'gate.appIconTitle',
  CALENDAR_IMPORT: 'gate.calendarImportTitle',
} as const satisfies Record<EntitlementFeature, string>;

interface EntitlementGateActions {
  /** 안내 없이 지금 막혔는지만 본다. 막힌 채 열린 화면이 내용을 그리지 않을 때 쓴다. 스냅샷을 아직 모르면 false다 */
  isBlocked: () => boolean;
  /** 시작하기 전에 확인한다. 막혔으면 안내를 띄우고 true다(멈춘다). 스냅샷을 아직 모르면 서버에 맡긴다 */
  promptIfBlocked: (options?: EntitlementGatePromptOptions) => boolean;
  promptLimit: (options?: EntitlementGatePromptOptions) => void;
  /** 서버가 한도·프리미엄 전용으로 막은 오류면 안내를 띄우고 true다(멈춘다). 그 밖의 오류는 부른 쪽이 처리한다 */
  promptIfBlockedError: (error: unknown, options?: EntitlementGatePromptOptions) => boolean;
}

export function useEntitlementGate(
  feature: EntitlementFeature,
  { surface }: { surface: EntitlementGateSurface },
): EntitlementGateActions {
  const openSheet = useOpenSheet();
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const upsellDismissalStorage = useStoredValueStorage(upsellDismissalStoredValue);
  const todayKey = useTodayKey();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const { t } = useTranslation('subscription');
  const formatRefillSentence = useFormatRefillSentence();

  const router = useRouter();
  const open = (
    target: EntitlementFeature,
    decision: BlockedDecision,
    trigger: LimitReachedTrigger,
    {
      onSubscribe,
      onFinish,
      title,
      description,
      alternativeAction,
    }: EntitlementGatePromptOptions = {},
  ) => {
    const latest = getCachedEntitlements(queryClient) ?? snapshot;
    const promptTitle = title ?? t(GATE_TITLE_KEYS[target]);
    const refill = formatRefillSentence(latest, target, getNowInstant());
    const analyticsFeature = getPremiumGateAnalyticsFeature(target);
    const isLimitReached = decision === 'limit-reached';
    if (isLimitReached) {
      trackEvent('limit_reached_shown', { feature: analyticsFeature, surface, trigger });
    }

    // 프리미엄·관리자가 공정 사용 한도에 닿으면 구독을 권하지 않고 언제 다시 쓸 수 있는지만 알린다
    if (!EntitlementPolicy.shouldOfferPremium(latest)) {
      toast.warning(promptTitle, { description: refill ?? undefined });
      onFinish?.();
      return;
    }

    const userId = getCachedMe(queryClient)?.id;
    const dismissedOn =
      readStoredValue(upsellDismissalStorage, upsellDismissalStoredValue, userId)[target] ?? null;
    const presentation = getUpsellPresentation(dismissedOn, todayKey, {
      hasAlternativeAction: alternativeAction != null,
    });

    const goToPaywall = (shownAs: UpsellPresentation) => {
      trackEvent('premium_gate_cta_tapped', {
        feature: analyticsFeature,
        surface,
        presentation: shownAs,
      });
      if (isLimitReached) {
        trackEvent('limit_reached_cta_tapped', { feature: analyticsFeature, surface });
      }
      onSubscribe?.();
      router.navigate({ pathname: '/paywall', params: { feature: target } });
    };

    trackEvent('premium_gate_shown', { feature: analyticsFeature, surface, presentation });

    if (presentation === 'toast') {
      toast.warning(promptTitle, {
        description: refill ?? undefined,
        action: { label: t('upsell.viewPremium'), onPress: () => goToPaywall('toast') },
      });
      onFinish?.();
      return;
    }

    // 버튼을 여러 번 눌러도 답은 처음 고른 하나로 끝나 이동·기록이 한 번만 일어난다. undefined는 답 없이
    // 사라졌을 때(부른 화면이 떠남)라 닫은 것으로 남기지 않고 onFinish도 부르지 않는다
    openSheet<UpsellChoice>(
      () => <PremiumUpsell feature={target} title={promptTitle} description={description} />,
      {
        footer: (close) => (
          <PremiumUpsell.Actions
            alternativeAction={
              alternativeAction == null
                ? undefined
                : { label: alternativeAction.label, onPress: () => close('alternative') }
            }
            onSubscribe={() => close('subscribe')}
            onLater={() => close('dismiss')}
          />
        ),
        dismissValue: 'dismiss',
      },
    ).then((choice) => {
      if (choice != null) {
        onFinish?.();
      }
      match(choice)
        .with('subscribe', () => goToPaywall('sheet'))
        .with('alternative', () => alternativeAction?.onPress())
        .with('dismiss', () => {
          trackEvent('premium_upsell_dismissed', { feature: analyticsFeature, surface });
          const dismissals = readStoredValue(
            upsellDismissalStorage,
            upsellDismissalStoredValue,
            userId,
          );
          writeStoredValue(
            upsellDismissalStorage,
            upsellDismissalStoredValue,
            { ...dismissals, [target]: todayKey },
            userId,
          );
        })
        .with(undefined, noop)
        .exhaustive();
    });
  };

  const findBlockedDecision = (): BlockedDecision | null => {
    if (snapshot == null) {
      return null;
    }
    return match(EntitlementPolicy.getAccessDecision(snapshot, feature, getNowInstant()))
      .with('allow', () => null)
      .with('limit-reached', 'locked', (decision) => decision)
      .exhaustive();
  };

  return {
    isBlocked: (): boolean => findBlockedDecision() != null,
    promptIfBlocked: (options?: EntitlementGatePromptOptions): boolean => {
      const decision = findBlockedDecision();
      if (decision == null) {
        return false;
      }
      open(feature, decision, 'precheck', options);
      return true;
    },
    promptLimit: (options?: EntitlementGatePromptOptions) => {
      open(feature, 'limit-reached', 'precheck', options);
    },
    promptIfBlockedError: (error: unknown, options?: EntitlementGatePromptOptions): boolean => {
      const limited = parseLimitedFeature(error);
      if (limited == null) {
        return false;
      }
      // 한도를 싣지 않은 거절에 스냅샷을 다시 받으면 열리는 시트의 사용량이 잠깐 비어 보여 그대로 둔다
      if (limited.featureQuota != null) {
        reflectFeatureQuota(queryClient, limited.featureQuota);
      }
      open(limited.feature, LimitedFeaturePolicy.getBlockedDecision(limited), 'server', options);
      return true;
    },
  };
}

interface PremiumUpsellProps {
  feature: EntitlementFeature;
  title: string;
  /** 부른 쪽이 상황을 직접 설명하면 사용량·숫자 대신 이 글을 보여 준다 */
  description?: string;
}

/** 한도·잠긴 기능 안내 시트의 내용. 버튼은 시트 아래에 고정되는 `PremiumUpsell.Actions`이고, 열 때 값이 굳는 overlay라 사용량은 내용이 직접 읽는다 */
function PremiumUpsell({ feature, title, description }: PremiumUpsellProps) {
  return (
    <VStack gap={20} testID="premium-upsell-sheet">
      <VStack gap={12} align="center">
        <PremiumFeatureIcon feature={feature} size="large" />
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {title}
        </H4>
        {description != null && (
          <Text size="b3" shade={7} align="center" lineBreakStrategyIOS="hangul-word">
            {description}
          </Text>
        )}
      </VStack>

      {/* 숫자를 못 읽어도 제목과 버튼만으로 안내는 끝나 자리를 비운다 */}
      {description == null && (
        <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
          <Suspense fallback={<PremiumUpsell.Loading />}>
            <PremiumUpsell.Unlock feature={feature} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </VStack>
  );
}

interface PremiumUpsellAlternativeAction {
  label: string;
  onPress: () => void;
}

interface PremiumUpsellActionsProps {
  /** 무료로 할 수 있는 다른 길. 있으면 주 버튼이 되고 프리미엄 보기는 글자 버튼으로 내려간다 */
  alternativeAction?: PremiumUpsellAlternativeAction;
  onSubscribe: () => void;
  onLater: () => void;
}

PremiumUpsell.Actions = function Actions({
  alternativeAction,
  onSubscribe,
  onLater,
}: PremiumUpsellActionsProps) {
  const { t } = useTranslation('subscription');

  if (alternativeAction == null) {
    return (
      <VStack gap={12}>
        <Button size="large" display="full" onPress={onSubscribe} testID="premium-upsell-cta">
          {t('upsell.viewPremium')}
        </Button>
        <TextButton size="medium" onPress={onLater}>
          {t('upsell.later')}
        </TextButton>
      </VStack>
    );
  }

  return (
    <VStack gap={12}>
      <Button size="large" display="full" onPress={alternativeAction.onPress}>
        {alternativeAction.label}
      </Button>
      <TextButton size="medium" onPress={onSubscribe} testID="premium-upsell-cta">
        {t('upsell.viewPremium')}
      </TextButton>
    </VStack>
  );
};

const LOCKED_DESCRIPTION_KEYS = {
  AI_REPORT: 'gate.aiReportDescription',
  AI_SUGGESTION: 'gate.aiSuggestionDescription',
  CUSTOM_REMINDER_TIME: 'gate.reminderTimeDescription',
  APP_ICON: 'gate.appIconDescription',
} as const satisfies Record<PlanFlagFeatureKey, string>;

/** 잠긴 기능은 무엇을 여는지, 한도 기능은 사용량과 "무료 → 프리미엄" 숫자, 기간 기능은 그 숫자만 보여 준다 */
PremiumUpsell.Unlock = function Unlock({ feature }: { feature: EntitlementFeature }) {
  const { t } = useTranslation('subscription');

  return match(feature)
    .with('AI_REPORT', 'AI_SUGGESTION', 'CUSTOM_REMINDER_TIME', 'APP_ICON', (lockedFeature) => (
      <Text size="b3" shade={7} align="center" lineBreakStrategyIOS="hangul-word">
        {t(LOCKED_DESCRIPTION_KEYS[lockedFeature])}
      </Text>
    ))
    .with('AI_PARSE', 'VOICE_NOTE', 'CHEER', 'NUDGE', 'FRIEND', 'TODO_CATEGORY', (limitFeature) => (
      <VStack gap={16}>
        <Usage feature={limitFeature} />
        <Comparison feature={limitFeature} />
      </VStack>
    ))
    .with('CALENDAR_IMPORT', (horizonFeature) => <Comparison feature={horizonFeature} />)
    .exhaustive();
};

PremiumUpsell.Loading = function Loading() {
  return (
    <VStack gap={16} accessibilityState={{ busy: true }}>
      <Skeleton className="h-2 rounded-full" />
      <Skeleton className="h-16 rounded-2xl" />
    </VStack>
  );
};

/** 기간마다 다시 생기는 한도를 다 썼을 때만 막대와 다시 생기는 날을 보여 준다 */
function Usage({ feature }: { feature: PlanLimitFeatureKey }) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { type } = useQuotaStatus(feature);
  const formatRefillSentence = useFormatRefillSentence();
  const now = useMinuteNow();
  const used = EntitlementPolicy.findUsedCount(entitlements, feature);
  const limit = EntitlementPolicy.findLimit(entitlements, feature);

  if (type !== 'used-up' || used == null || limit == null) {
    return null;
  }

  const refill = formatRefillSentence(entitlements, feature, now);

  return (
    <VStack gap={8}>
      <Meter
        value={used}
        max={limit}
        size="medium"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <HStack gap={8} justify="between" align="center">
        <Text size="e1" shade={6} className="tabular-nums">
          {t('upsell.usage', {
            used: formatCount(used, locale),
            limit: formatCount(limit, locale),
          })}
        </Text>
        {refill != null && (
          <Text size="e1" weight="semibold" shade={7} align="right" className="flex-1">
            {refill}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}

function Comparison({ feature }: { feature: PlanLimitFeatureKey | PlanHorizonFeatureKey }) {
  const { t } = useTranslation('subscription');
  const fontScaledSize = useFontScaledSize();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = EntitlementPolicy.getPlanFeatureComparison(entitlements, feature);
  const formatPlanValue = useFormatPlanValue();

  return (
    <SurfaceCard className="flex-row items-center gap-3">
      <VStack flex={1} gap={2} align="center">
        <Text size="e1" shade={6}>
          {t('upsell.free')}
        </Text>
        <Text size="b3" weight="bold" shade={8}>
          {formatPlanValue(free)}
        </Text>
      </VStack>
      <ArrowRightIcon
        width={fontScaledSize(16)}
        height={fontScaledSize(16)}
        colorClassName="text-gray-5"
      />
      <VStack flex={1} gap={2} align="center">
        <Text size="e1" shade={6}>
          {t('upsell.premium')}
        </Text>
        <Text size="b3" weight="bold" tone="brand">
          {formatPlanValue(premium)}
        </Text>
      </VStack>
    </SurfaceCard>
  );
}
