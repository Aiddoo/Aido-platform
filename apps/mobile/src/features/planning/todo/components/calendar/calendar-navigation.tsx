import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, HStack, IconButton } from '@src/shared/ui';
import type { ComponentProps } from 'react';

interface CalendarNavigationProps extends Pick<ComponentProps<typeof HStack>, 'ref'> {
  onPrevious: () => void;
  onNext: () => void;
}

export function CalendarNavigation({ ref, onPrevious, onNext }: CalendarNavigationProps) {
  const { t } = useTranslation('common');

  return (
    <HStack ref={ref} gap={4}>
      <IconButton
        accessibilityLabel={t('calendar.previousMonth')}
        icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />}
        className="min-h-0 min-w-0 p-1"
        hitSlop={8}
        onPress={onPrevious}
      />
      <IconButton
        accessibilityLabel={t('calendar.nextMonth')}
        icon={<ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />}
        className="min-h-0 min-w-0 p-1"
        hitSlop={8}
        onPress={onNext}
      />
    </HStack>
  );
}
