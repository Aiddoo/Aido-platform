import { TodoRepeatPickerContent } from '@src/features/todo/components/todo-repeat-picker-content';
import type { TodoRepeat } from '@src/features/todo/domains/todo-repeat.model';
import { formatRepeatSummary } from '@src/features/todo/utils/format-repeat-summary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionChip,
  ModalBottomSheet,
  RepeatIcon,
  useActionChipIconSize,
  useOverlay,
} from '@src/shared/ui';
import { toDate } from '@src/shared/utils/date';
import { toDeviceDateKey } from '@src/shared/utils/date-key';

interface PlanRepeatChipProps {
  value: TodoRepeat | null;
  startDate: string;
  /** 반복을 바꾸면 시작일도 함께 바뀔 수 있다. 반복을 끝내면 `null` */
  onChange: (repeat: TodoRepeat | null, startDate: string) => void;
}

/** 계획 카드의 반복 칩. 할 일 추가 시트와 같은 반복 선택 화면을 그대로 연다 */
export function PlanRepeatChip({ value, startDate, onChange }: PlanRepeatChipProps) {
  const { t } = useTranslation('todo');
  const iconSize = useActionChipIconSize();
  const overlay = useOverlay();
  const dateFormatContext = useDateFormatContext();

  const handlePress = () => {
    overlay.open<void>(({ isOpen, close, exit }) => (
      <ModalBottomSheet hasFixedHeader isOpen={isOpen} onOpenChange={() => close()} onExit={exit}>
        <TodoRepeatPickerContent
          value={{ startDate: toDate(startDate), repeat: value }}
          onChange={(picked) => {
            onChange(picked.repeat, toDeviceDateKey(picked.startDate));
            close();
          }}
          onCancel={() => close()}
        />
      </ModalBottomSheet>
    ));
  };

  return (
    <ActionChip
      icon={
        <RepeatIcon
          width={iconSize}
          height={iconSize}
          colorClassName={value == null ? 'text-gray-5' : 'text-main'}
        />
      }
      label={value == null ? t('chip.repeat') : formatRepeatSummary(value, dateFormatContext)}
      isActive={value != null}
      onPress={handlePress}
    />
  );
}
