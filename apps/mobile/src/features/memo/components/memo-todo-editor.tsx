import type { ParsedMemoTodo } from '@src/features/ai/domains/ai.model';
import { CategorySelectInput } from '@src/features/todo/components/category-select-bottom-sheet';
import { TodoDatePickerContent } from '@src/features/todo/components/todo-date-picker-content';
import { TodoTimePickerContent } from '@src/features/todo/components/todo-time-picker-content';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  ACTION_CHIP_ICON_SIZE,
  ActionChip,
  Box,
  CalendarIcon,
  ClockIcon,
  HStack,
  ModalBottomSheet,
  RobotPixelIcon,
  Spacing,
  Text,
  VStack,
  useOverlay,
} from '@src/shared/ui';
import { formatDate, formatDaysOfWeek, formatMonthDay } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CloseButton } from 'heroui-native';
import { Suspense } from 'react';
import { ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

interface MemoTodoEditorProps {
  todo: ParsedMemoTodo;
  onChange: (updates: Partial<ParsedMemoTodo>) => void;
  onRemove: () => void;
}

export function MemoTodoEditor({ todo, onChange, onRemove }: MemoTodoEditorProps) {
  const { t } = useTranslation('memo');
  const { data: categoriesData } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const overlay = useOverlay();

  const category = categoriesData.categories.find((category) => category.id === todo.categoryId);

  const dateLabel = todo.endDate
    ? `${formatMonthDay(todo.startDate)} ~ ${formatMonthDay(todo.endDate)}`
    : formatMonthDay(todo.startDate);

  const timeLabel = todo.isAllDay
    ? t('aiReview.allDay')
    : (todo.scheduledTime ?? t('aiReview.allDay'));

  const openDatePicker = () => {
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
        <TodoDatePickerContent
          startDate={new Date(todo.startDate)}
          onConfirm={(date) => {
            onChange({ startDate: formatDate(date) });
            close(date);
          }}
          onCancel={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };

  const openTimePicker = () => {
    overlay.open<{ time: string | undefined; isAllDay: boolean } | null>(
      ({ isOpen, close, exit }) => (
        <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
          <Suspense fallback={<ActivityIndicator />}>
            <TodoTimePickerContent
              draftDate={new Date(todo.startDate)}
              scheduledTime={todo.scheduledTime ?? undefined}
              isAllDay={todo.isAllDay}
              onConfirm={(time, isAllDay) => {
                onChange({ scheduledTime: time ?? null, isAllDay });
                close({ time, isAllDay });
              }}
              onCancel={() => close(null)}
            />
          </Suspense>
        </ModalBottomSheet>
      ),
    );
  };

  const openCategoryPicker = () => {
    overlay.open<number | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isOpen} onClose={() => close(null)} onExit={exit}>
        <Suspense fallback={<ActivityIndicator />}>
          <CategorySelectInput
            value={todo.categoryId}
            onChange={(categoryId) => {
              onChange({ categoryId });
              close(categoryId);
            }}
            submitLabel={t('aiReview.select')}
          />
        </Suspense>
      </ModalBottomSheet>
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
          {todo.items.map((item) => (
            <HStack key={item.title} align="center" gap={8}>
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
              width={ACTION_CHIP_ICON_SIZE}
              height={ACTION_CHIP_ICON_SIZE}
              colorClassName="text-gray-5"
            />
          }
          label={dateLabel}
          onPress={openDatePicker}
        />
        <ActionChip
          icon={
            <ClockIcon
              width={ACTION_CHIP_ICON_SIZE}
              height={ACTION_CHIP_ICON_SIZE}
              colorClassName="text-gray-5"
            />
          }
          label={timeLabel}
          onPress={openTimePicker}
        />
        <ActionChip
          icon={
            <Box className="size-2 rounded-full" style={{ backgroundColor: category?.color }} />
          }
          label={category?.name ?? t('aiReview.categoryFallback')}
          onPress={openCategoryPicker}
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
