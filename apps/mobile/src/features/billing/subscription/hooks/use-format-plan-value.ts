import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { formatCount } from '@src/shared/utils/number-format';
import { match } from 'ts-pattern';

import type { PlanValue } from '../utils/plan-benefit.view-model';

/** 비교 칸 값을 글자로 바꾼다. 혜택 장의 한도 띠와 비교표가 같은 말을 쓴다 */
export function useFormatPlanValue() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();

  return (value: PlanValue) =>
    match(value)
      .with({ type: 'amount' }, ({ unit, amount }) => {
        const formatted = formatCount(amount, locale);
        return match(unit)
          .with('perMonth', () => t('upsell.amount.perMonth', { amount: formatted }))
          .with('perDay', () => t('upsell.amount.perDay', { amount: formatted }))
          .with('people', () => t('upsell.amount.people', { amount: formatted }))
          .with('items', () => t('upsell.amount.items', { amount: formatted }))
          .exhaustive();
      })
      .with({ type: 'unlimited' }, () => t('upsell.unlimited'))
      .with({ type: 'included' }, () => t('planComparison.included'))
      .with({ type: 'excluded' }, () => t('planComparison.excluded'))
      .exhaustive();
}
