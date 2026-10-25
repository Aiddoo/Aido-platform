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
  Input,
  RobotPixelIcon,
  Spacing,
  Text,
  VStack,
  useOverlay,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { formatDate, formatDaysOfWeek, toDate } from '@src/shared/utils/date';
import { formatDateKeyLabel, formatDateKeyRange } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CloseButton } from 'heroui-native';
import { useFormContext, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { match, P } from 'ts-pattern';

import {
  type MemoReviewFormValues,
  reviewedTodoTitleSchema,
} from '../domains/memo-review-form.schema';
import { MemoTodoCategoryBottomSheet } from './memo-todo-category-bottom-sheet';
import { MemoTodoDateBottomSheet } from './memo-todo-date-bottom-sheet';
import { MemoTodoTimeBottomSheet } from './memo-todo-time-bottom-sheet';

interface MemoTodoEditorProps {
  /** 검토 폼(`todos`)에서 고칠 할 일의 위치 */
  index: number;
  onRemove: () => void;
}

/** AI가 나눈 할 일 하나의 제목·날짜·시간·카테고리를 검토 폼 안에서 고친다 */
export function MemoTodoEditor({ index, onRemove }: MemoTodoEditorProps) {
  const actionChipIconSize = useActionChipIconSize();
  const { t } = useTranslation(['memo', 'todo']);
  const { control, setValue } = useFormContext<MemoReviewFormValues>();
  const todo = useWatch({ control, name: `todos.${index}` });
  const dateFormatContext = useDateFormatContext();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const overlay = useOverlay();

  const category = categoriesResult.categories.find((category) => category.id === todo.categoryId);

  const dateLabel = todo.endDate
    ? formatDateKeyRange(todo.startDate, todo.endDate, dateFormatContext)
    : formatDateKeyLabel(todo.startDate, 'monthDay', dateFormatContext);

  const timeLabel = todo.isAllDay
    ? t('memo:aiReview.allDay')
    : (todo.scheduledTime ?? t('memo:aiReview.allDay'));

  const handleDateChipPress = () => {
    overlay.open<Date | null>(({ isOpen, close, exit }) => (
      <MemoTodoDateBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={exit}
        value={toDate(todo.startDate)}
        onChange={(date) => {
          setValue(`todos.${index}.startDate`, formatDate(date), { shouldDirty: true });
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
          setValue(`todos.${index}.scheduledTime`, value.scheduledTime ?? null, {
            shouldDirty: true,
          });
          setValue(`todos.${index}.isAllDay`, value.isAllDay, { shouldDirty: true });
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
          setValue(`todos.${index}.categoryId`, categoryId, { shouldDirty: true });
          close(categoryId);
        }}
        submitLabel={t('memo:aiReview.select')}
      />
    ));
  };

  return (
    <VStack px={20} py={16} className="overflow-hidden rounded-2xl bg-gray-1">
      <Box className="absolute right-2 top-2 z-10">
        <CloseButton onPress={onRemove} iconProps={{ size: 14 }} />
      </Box>

      <Box className="mr-6">
        <FormField control={control} name={`todos.${index}.title`}>
          {({ value, onChange, onBlur }, { error }) => (
            <Input
              variant="line"
              className="px-0"
              accessibilityLabel={t('memo:aiReview.titleLabel')}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              maxLength={reviewedTodoTitleSchema.maxLength ?? undefined}
              returnKeyType="done"
              isInvalid={error != null}
              errorMessage={match(error)
                .with(P.nullish, () => undefined)
                .with({ type: 'too_big' }, () => t('todo:form.titleMaxLength'))
                .otherwise(() => t('todo:form.titleRequired'))}
            />
          )}
        </FormField>
      </Box>

      <Spacing size={4} />

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
          label={category?.name ?? t('memo:aiReview.categoryFallback')}
          onPress={handleCategoryChipPress}
        />
      </ScrollView>

      {todo.isRecurring && todo.recurrence && (
        <Text size="e1" shade={6}>
          {t('memo:aiReview.weeklyRepeat', { days: formatDaysOfWeek(todo.recurrence.daysOfWeek) })}
        </Text>
      )}

      <Box className="absolute -bottom-6 -right-2 rotate-[-10deg] opacity-30" pointerEvents="none">
        <RobotPixelIcon width={96} height={96} colorClassName="text-main" />
      </Box>
    </VStack>
  );
}
