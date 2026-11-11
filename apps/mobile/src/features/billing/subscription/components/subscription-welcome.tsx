import { useTrack } from '@src/shared/analytics';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  CrownFilledIcon,
  H2,
  HStack,
  IconCircle,
  StampPress,
  ListRow,
  SettingsListGroup,
  Text,
  VStack,
} from '@src/shared/ui';
import type { ComponentType } from 'react';
import { match } from 'ts-pattern';

import type { PremiumQuickstartAction } from '../constants/subscription.events';
import type { SubscriptionPlan } from '../domains/subscription.model';
import { useCheckoutRoute } from '../hooks/use-checkout-route';
import { getPlanPriceLabelKey } from '../utils/subscription-label.view-model';
import { toTrialScheduleSteps } from '../utils/trial-schedule.view-model';

const CROWN_CIRCLE_SIZE = 72;
const CROWN_ICON_SIZE = 36;

interface SubscriptionWelcomeProps {
  /** 방금 산 요금제. 서버 반영(/me)이 늦거나 실패해도 같은 화면을 그린다 */
  plan: SubscriptionPlan;
  /** 결제한 날. 체험 일정은 이 날부터 센다 */
  purchasedOn: DateKey;
  hadRewardOnly: boolean;
  /** 체험 알림 칸. billing은 알림 기능을 모르므로 화면이 채운다 */
  reminder?: ComponentType<{ reminderDateKey: DateKey }>;
}

export function SubscriptionWelcome({
  plan,
  purchasedOn,
  hadRewardOnly,
  reminder: Reminder,
}: SubscriptionWelcomeProps) {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();
  const steps = toTrialScheduleSteps(plan, purchasedOn);
  const reminderStep = steps?.find((step) => step.kind === 'reminder');
  const chargeStep = steps?.find((step) => step.kind === 'charge');
  const price = t(getPlanPriceLabelKey(plan.planType), { price: plan.priceString });
  const formatDate = (dateKey: DateKey) =>
    formatYearAwareDateKeyLabel(dateKey, todayKey, dateFormatContext);

  return (
    <VStack gap={20} testID="subscription-welcome">
      <VStack gap={12} align="center">
        {/* 결제를 마친 순간이라 왕관이 한 번 떠오르고 테두리가 퍼진다(햅틱은 결제 성공이 이미 준다) */}
        <StampPress motion="rise">
          <IconCircle
            tone="brand"
            style={{
              width: fontScaledSize(CROWN_CIRCLE_SIZE),
              height: fontScaledSize(CROWN_CIRCLE_SIZE),
            }}
            icon={
              <CrownFilledIcon
                width={fontScaledSize(CROWN_ICON_SIZE)}
                height={fontScaledSize(CROWN_ICON_SIZE)}
                colorClassName="text-white dark:text-gray-1"
              />
            }
          />
        </StampPress>
        <VStack gap={4} align="center">
          <H2 align="center">{t('welcome.title')}</H2>
          <Text size="b3" shade={7} align="center" lineBreakStrategyIOS="hangul-word">
            {chargeStep == null
              ? t('welcome.subtitle')
              : t('welcome.subtitleTrial', { date: formatDate(chargeStep.dateKey) })}
          </Text>
        </VStack>
      </VStack>

      <SettingsListGroup>
        <SummaryRow label={t('welcome.rows.plan')} value={price} />
        {reminderStep != null && (
          <>
            <SettingsListGroup.Separator />
            <SummaryRow
              label={t('welcome.rows.reminder')}
              value={formatDate(reminderStep.dateKey)}
            />
          </>
        )}
        {chargeStep != null && (
          <>
            <SettingsListGroup.Separator />
            <SummaryRow
              label={t('welcome.rows.firstCharge')}
              value={t('receipt.rows.dateWithPrice', {
                date: formatDate(chargeStep.dateKey),
                price,
              })}
            />
          </>
        )}
      </SettingsListGroup>

      {hadRewardOnly && (
        <Text
          size="b4"
          shade={8}
          lineBreakStrategyIOS="hangul-word"
          testID="welcome-reward-continues"
        >
          {t('welcome.rewardContinues')}
        </Text>
      )}

      {Reminder != null && reminderStep != null && (
        <Reminder reminderDateKey={reminderStep.dateKey} />
      )}

      <VStack gap={4}>
        <Text size="b3" weight="bold" shade={9}>
          {t('welcome.quickstart.title')}
        </Text>
        <QuickstartRow action="voice_note" />
        <QuickstartRow action="ai_report" />
        <QuickstartRow action="app_icon" />
      </VStack>
    </VStack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="between" align="center" gap={12} className="min-h-12 px-4 py-3">
      <Text size="b4" shade={7}>
        {label}
      </Text>
      <Text size="b4" weight="semibold" shade={9} align="right" className="shrink tabular-nums">
        {value}
      </Text>
    </HStack>
  );
}

function QuickstartRow({ action }: { action: PremiumQuickstartAction }) {
  const { t } = useTranslation('subscription');
  const { trackEvent } = useTrack();
  const { leaveTo } = useCheckoutRoute();
  const { title, description, open } = match(action)
    .with('voice_note', () => ({
      title: t('welcome.quickstart.voiceNote.title'),
      description: t('welcome.quickstart.voiceNote.description'),
      open: () => leaveTo('/voice-notes/record'),
    }))
    .with('ai_report', () => ({
      title: t('welcome.quickstart.aiReport.title'),
      description: t('welcome.quickstart.aiReport.description'),
      open: () => leaveTo('/reports'),
    }))
    .with('app_icon', () => ({
      title: t('welcome.quickstart.appIcon.title'),
      description: t('welcome.quickstart.appIcon.description'),
      open: () => leaveTo('/settings/app-icon'),
    }))
    .exhaustive();

  return (
    <ListRow
      onPress={() => {
        trackEvent('premium_quickstart_tapped', { action });
        open();
      }}
      contents={<ListRow.Texts type="2RowTypeA" top={title} bottom={description} />}
      right={<ArrowRightIcon colorClassName="text-gray-5" />}
    />
  );
}
