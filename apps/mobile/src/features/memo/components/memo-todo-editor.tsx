import type { ParsedMemoTodo } from '@src/features/ai/domains/ai.model';
import type { TodoTimeValue } from '@src/features/todo/components/todo-time-picker-content';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  ActionChip,
  useActionChipIconSize,
  Box,
  CalendarIcon,
  ClockIcon,
  HStack,
  RobotPixelIcon,
  Spacing,
  Text,
  VStack,
  useOverlay,
} from '@src/shared/ui';
import { formatDate, formatDaysOfWeek, toDate } from '@src/shared/utils/date';
import { formatDateKeyLabel, formatDateKeyRange } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CloseButton } from 'heroui-native';
import { ScrollView, TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { MemoTodoCategoryBottomSheet } from './memo-todo-category-bottom-sheet';
import { MemoTodoDateBottomSheet } from './memo-todo-date-bottom-sheet';
import { MemoTodoTimeBottomSheet } from './memo-todo-time-bottom-sheet';

const StyledTextInput = withUniwind(TextInput);

interface MemoTodoEditorProps {
  todo: ParsedMemoTodo;
  onChange: (updates: Partial<ParsedMemoTodo>) => void;
  onRemove: () => void;
}

export function MemoTodoEditor({ todo, onChange, onRemove }: MemoTodoEditorProps) {
  const actionChipIconSize = useActionChipIconSize();
  const { t } = useTranslation('memo');
  const dateFormatContext = useDateFormatContext();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const overlay = useOverlay();

  const category = categoriesResult.categories.find((category) => category.id === todo.categoryId);

  const dateLabel = todo.endDate
    ? formatDateKeyRange(todo.startDate, todo.endDate, dateFormatContext)
    : formatDateKeyLabel(todo.startDate, 'monthDay', dateFormatContext);

  const timeLabel = todo.isAllDay
    ? t('aiReview.allDay')
    : (todo.scheduledTime ?? t('aiReview.allDay'));

  const handleDateChipPress = () => {
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <MemoTodoDateBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
        value={toDate(todo.startDate)}
        onChange={(date) => {
          onChange({ startDate: formatDate(date) });
          close(date);
        }}
        onCancel={() => close(null)}
      />
    ));
  };

  const handleTimeChipPress = () => {
    overlay.open<TodoTimeValue | null>(({ isOpen, close, exit }) => (
      <MemoTodoTimeBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
        date={toDate(todo.startDate)}
        value={{ scheduledTime: todo.scheduledTime ?? undefined, isAllDay: todo.isAllDay }}
        onChange={(value) => {
          onChange({ scheduledTime: value.scheduledTime ?? null, isAllDay: value.isAllDay });
          close(value);
        }}
        onCancel={() => close(null)}
      />
    ));
  };

  const handleCategoryChipPress = () => {
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <MemoTodoCategoryBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
        value={todo.categoryId}
        onChange={(categoryId) => {
          onChange({ categoryId });
          close(categoryId);
        }}
        submitLabel={t('aiReview.select')}
      />
    ));
  };

  return (
    <VStack px={20} py={16} className="overflow-hidden rounded-2xl bg-gray-1">
      <Box className="absolute right-2 top-2 z-10">
        <CloseButton onPress={onRemove} iconProps={{ size: 14 }} />
      </Box>

      <VStack className="mr-6 border-b-2 border-gray-3 dark:border-gray-2">
        <StyledTextInput
          value={todo.title}
          onChangeText={(text) => onChange({ title: text })}
          className="text-b1 font-semibold text-gray-9"
          allowFontScaling={false}
        />
      </VStack>

      <Spacing size={12} />

      {todo.items.length > 0 && (
        <VStack className="gap-1.5 pl-2 pr-4">
          {todo.items.map((item, index) => (
            <HStack key={index} align="center" gap={8}>
              <Box className="size-1.5 rounded-full bg-gray-5" />
              <Text size="b3" shade={8}>
                {item.title}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}

      <Spacing size={16} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        <ActionChip
          icon={
            <CalendarIcon
              width={actionChipIconSize}
              height={actionChipIconSize}
              colorClassName="text-gray-5"
            />
          }
          label={dateLabel}
          onPress={handleDateChipPress}
        />
        <ActionChip
          icon={
            <ClockIcon
              width={actionChipIconSize}
              height={actionChipIconSize}
              colorClassName="text-gray-5"
            />
          }
          label={timeLabel}
          onPress={handleTimeChipPress}
        />
        <ActionChip
          icon={
            <Box className="size-2 rounded-full" style={{ backgroundColor: category?.color }} />
          }
          label={category?.name ?? t('aiReview.categoryFallback')}
          onPress={handleCategoryChipPress}
        />
      </ScrollView>

      {todo.isRecurring && todo.recurrence && (
        <Text size="e1" shade={6}>
          {t('aiReview.weeklyRepeat', { days: formatDaysOfWeek(todo.recurrence.daysOfWeek) })}
        </Text>
      )}

      <Box className="absolute -bottom-6 -right-2 rotate-[-10deg] opacity-30" pointerEvents="none">
        <RobotPixelIcon width={96} height={96} colorClassName="text-main" />
      </Box>
    </VStack>
  );
}
