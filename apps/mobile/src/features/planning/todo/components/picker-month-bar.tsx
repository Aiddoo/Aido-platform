import type { DateKey } from '@src/shared/date/date-key';
import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, HStack, IconButton, Text } from '@src/shared/ui';

interface PickerMonthBarProps {
  /** 보이는 달의 아무 날(YYYY-MM-DD) */
  displayMonthKey: DateKey;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function PickerMonthBar({
  displayMonthKey,
  onPreviousMonth,
  onNextMonth,
}: PickerMonthBarProps) {
  const { t } = useTranslation('common');
  const fontScaledSize = useFontScaledSize();
  const dateFormatContext = useDateFormatContext();

  return (
    <HStack className="items-center justify-between px-4">
      <IconButton
        accessibilityLabel={t('calendar.previousMonth')}
        icon={
          <ArrowLeftIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-6"
          />
        }
        className="size-5 min-h-0 min-w-0"
        hitSlop={12}
        onPress={onPreviousMonth}
      />
      <Text size="b2" weight="semibold" tone="neutral" shade={9}>
        {formatDateKeyLabel(displayMonthKey, 'yearMonth', dateFormatContext)}
      </Text>
      <IconButton
        accessibilityLabel={t('calendar.nextMonth')}
        icon={
          <ArrowRightIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-6"
          />
        }
        className="size-5 min-h-0 min-w-0"
        hitSlop={12}
        onPress={onNextMonth}
      />
    </HStack>
  );
}
