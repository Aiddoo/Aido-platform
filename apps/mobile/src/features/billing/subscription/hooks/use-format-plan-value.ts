import { useTranslation } from '@src/shared/i18n';
import { match } from 'ts-pattern';

import type { PlanValue } from '../domains/entitlement.model';
import { useFormatPlanAmount } from './use-format-plan-amount';

/** 비교 칸 값을 글자로 바꾼다. 혜택 장의 한도 띠와 비교표가 같은 말을 쓴다 */
export function useFormatPlanValue() {
  const { t } = useTranslation('subscription');
  const formatPlanAmount = useFormatPlanAmount();

  return (value: PlanValue) =>
    match(value)
      .with({ type: 'amount' }, ({ unit, amount }) => {
        const formatted = formatPlanAmount(amount);
        return match(unit)
          .with('perMonth', () => t('upsell.amount.perMonth', { amount: formatted }))
          .with('perDay', () => t('upsell.amount.perDay', { amount: formatted }))
          .with('people', () => t('upsell.amount.people', { amount: formatted }))
          .with('items', () => t('upsell.amount.items', { amount: formatted }))
          .with('days', () => t('upsell.amount.days', { amount: formatted }))
          .exhaustive();
      })
      .with({ type: 'unlimited' }, () => formatPlanAmount(null))
      .with({ type: 'included' }, () => t('planComparison.included'))
      .with({ type: 'excluded' }, () => t('planComparison.excluded'))
      .exhaustive();
}
