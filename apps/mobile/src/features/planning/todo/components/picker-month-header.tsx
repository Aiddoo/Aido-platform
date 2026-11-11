import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, HStack, IconButton, Text } from '@src/shared/ui';

interface PickerMonthHeaderProps {
  displayMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function PickerMonthHeader({
  displayMonth,
  onPreviousMonth,
  onNextMonth,
}: PickerMonthHeaderProps) {
  const { t } = useTranslation('common');
  const dateFormatContext = useDateFormatContext();

  return (
    <HStack className="items-center justify-between px-4">
      <IconButton
        accessibilityLabel={t('calendar.previousMonth')}
        icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />}
        className="min-h-0 min-w-0"
        hitSlop={12}
        onPress={onPreviousMonth}
      />
      <Text size="b2" weight="semibold" tone="neutral" shade={9}>
        {formatDateKeyLabel(
          toDateKey(displayMonth, dateFormatContext.timeZone),
          'yearMonth',
          dateFormatContext,
        )}
      </Text>
      <IconButton
        accessibilityLabel={t('calendar.nextMonth')}
        icon={<ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />}
        className="min-h-0 min-w-0"
        hitSlop={12}
        onPress={onNextMonth}
      />
    </HStack>
  );
}
