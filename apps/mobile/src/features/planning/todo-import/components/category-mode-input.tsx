import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { CategoryDuoIcon, IconButton, InfoIcon, SettingsListGroup } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';
import { type ComponentProps, useState } from 'react';

import {
  type TodoImportCategoryMode,
  todoImportCategoryModeSchema,
} from '../schemas/todo-import-form.schema';

interface CategoryModeInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> {
  value: TodoImportCategoryMode;
  onValueChange: (value: TodoImportCategoryMode) => void;
}

/** 캘린더마다 나눌지, 한 카테고리에 모을지 고른다. 테마·글꼴 크기 설정처럼 설명이 붙은 라디오 행이다 */
export function CategoryModeInput({ value, onValueChange, ...props }: CategoryModeInputProps) {
  const { t } = useTranslation('todoImport');

  const handleValueChange = (next: string) => {
    const parsed = todoImportCategoryModeSchema.safeParse(next);
    if (parsed.success) {
      onValueChange(parsed.data);
    }
  };

  return (
    <SettingsListGroup>
      <RadioGroup value={value} onValueChange={handleValueChange} className="gap-0" {...props}>
        <SettingsListGroup.Radio
          value="separate"
          label={t('categories.mode.separate')}
          description={t('categories.mode.separateDescription')}
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Radio
          value="single"
          label={t('categories.allInOne')}
          description={t('categories.mode.singleDescription')}
        />
      </RadioGroup>
    </SettingsListGroup>
  );
}

/**
 * 고르는 자리 옆 ⓘ. 처음 한 번은 스스로 열려 고르는 자리를 짚고(누름은 아래 선택지로 넘긴다), 그 뒤로는
 * 눌러서 가져온 뒤에도 카테고리를 바꿀 수 있다는 안내를 연다
 */
CategoryModeInput.Hint = function Hint() {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <CoachmarkPopover
      kind="todo-import-category-mode"
      description={isInfoOpen ? t('categories.mode.hint') : t('categories.mode.coachmark')}
      Icon={CategoryDuoIcon}
      placement="top"
      align="start"
      avoidCollisions
      isForced={isInfoOpen}
      isPassThrough={!isInfoOpen}
      onDismiss={() => setIsInfoOpen(false)}
    >
      <IconButton
        accessibilityLabel={t('categories.mode.hintLabel')}
        icon={
          <InfoIcon
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            colorClassName="text-gray-5"
          />
        }
        className="size-4 min-h-0 min-w-0"
        hitSlop={14}
        onPress={() => setIsInfoOpen(true)}
      />
    </CoachmarkPopover>
  );
};
