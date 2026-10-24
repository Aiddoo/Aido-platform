import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheet, Box, Button, CheckIcon, ListRow, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, useState } from 'react';

interface CategorySelectBottomSheetProps
  extends Omit<ComponentProps<typeof BottomSheet>, 'children'>, CategorySelectInputProps {}

export function CategorySelectBottomSheet({
  value,
  onChange,
  submitLabel,
  isPending,
  ...sheetProps
}: CategorySelectBottomSheetProps) {
  return (
    <BottomSheet {...sheetProps}>
      {sheetProps.isOpen && (
        <CategorySelectInput
          value={value}
          onChange={onChange}
          submitLabel={submitLabel}
          isPending={isPending}
        />
      )}
    </BottomSheet>
  );
}

interface CategorySelectInputProps {
  /** 처음 선택된 카테고리. 시트 안에서 고른 값은 제출할 때 onChange로 전달한다. */
  value: number;
  onChange: (categoryId: number) => Promise<unknown> | void;
  submitLabel: string;
  /** 제출을 처리하는 mutation의 `isPending`. */
  isPending?: boolean;
}

/** 카테고리 목록을 스스로 조회하고, 고른 카테고리를 제출 버튼으로 확정한다. */
export function CategorySelectInput({
  value,
  onChange,
  submitLabel,
  isPending = false,
}: CategorySelectInputProps) {
  const { t } = useTranslation('todo');
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const [localCategoryId, setLocalCategoryId] = useState(value);

  return (
    <VStack gap={20}>
      <Text size="b3" weight="semibold">
        {t('category.select')}
      </Text>

      <VStack gap={8}>
        {data.categories.map((category) => {
          const isSelected = localCategoryId === category.id;

          return (
            <PressableFeedback
              key={category.id}
              onPress={() => setLocalCategoryId(category.id)}
              className="rounded-xl"
            >
              <PressableFeedback.Highlight className="rounded-xl" />
              <ListRow
                left={
                  <Box
                    className="size-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                }
                contents={<Text size="b3">{category.name}</Text>}
                right={
                  isSelected ? (
                    <CheckIcon width={18} height={18} colorClassName="text-main" />
                  ) : undefined
                }
                horizontalPadding="medium"
                className="bg-gray-1 rounded-xl"
              />
            </PressableFeedback>
          );
        })}
      </VStack>

      <Button size="large" onPress={() => onChange(localCategoryId)} isLoading={isPending}>
        {submitLabel}
      </Button>
    </VStack>
  );
}
