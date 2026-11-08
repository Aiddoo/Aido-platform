import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { BottomSheetInput, HStack, VStack } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { Controller, type Control } from 'react-hook-form';

import { CATEGORY_COLORS } from '../constants/todo-category.constants';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import { CategoryColorInput } from './category-color-input';

interface CategoryFormFieldsProps {
  control: Control<TodoCategoryFormValues>;
  onSubmit: () => void;
}

/** 만들기와 고치기 시트가 함께 쓰는 이름·색 입력. 제출은 각 시트가 맡는다 */
export function CategoryFormFields({ control, onSubmit }: CategoryFormFieldsProps) {
  const { t } = useTranslation('todo');

  return (
    <VStack gap={20}>
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <BottomSheetInput
            autoFocus
            label={t('category.nameLabel')}
            placeholder={t('category.namePlaceholder')}
            value={value}
            onChange={onChange}
            isInvalid={error != null}
            errorMessage={resolveValidationMessage(error, {
              default: 'categoryName.required',
              byType: { too_big: 'categoryName.tooLong' },
            })}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field: { value, onChange } }) => (
          <CategoryColorInput value={value} onValueChange={onChange} />
        )}
      />
    </VStack>
  );
}

/** 입력 칸과 색 칸의 자리를 같은 크기로 잡아 읽은 뒤 시트 높이가 튀지 않게 한다 */
CategoryFormFields.Loading = function Loading() {
  return (
    <VStack gap={20}>
      <Skeleton className="h-20 w-full rounded-xl" />
      <HStack wrap="wrap" align="center" justify="center" className="gap-2.5">
        {range(CATEGORY_COLORS.length).map((index) => (
          <Skeleton key={index} className="size-8 rounded-full" />
        ))}
      </HStack>
    </VStack>
  );
};
