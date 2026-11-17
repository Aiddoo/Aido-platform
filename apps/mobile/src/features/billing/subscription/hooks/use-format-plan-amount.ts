import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { formatCount } from '@src/shared/utils/number-format';

/** 요금제 숫자 하나를 문구에 넣을 글자로 바꾼다. 서버 요금제 값의 null은 무제한이다 */
export function useFormatPlanAmount() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();

  return (amount: number | null) =>
    amount == null ? t('upsell.unlimited') : formatCount(amount, locale);
}
