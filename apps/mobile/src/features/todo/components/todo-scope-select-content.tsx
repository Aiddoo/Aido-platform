import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, ListRow, Text, TrashIcon, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { TodoEditScope } from '../domains/todo-repeat.model';

type TodoScopeAction = 'edit' | 'delete';

interface ScopeRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isDanger?: boolean;
}

function ScopeRow({ label, isDanger = false, ...pressableProps }: ScopeRowProps) {
  return (
    <PressableFeedback accessibilityRole="button" accessibilityLabel={label} {...pressableProps}>
      <ListRow
        horizontalPadding="medium"
        verticalPadding="medium"
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{ size: 'b2', ...(isDanger && { tone: 'danger' as const }) }}
          />
        }
        right={
          isDanger ? (
            <TrashIcon width={16} height={16} colorClassName="text-error" />
          ) : (
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />
          )
        }
      />
    </PressableFeedback>
  );
}

interface TodoScopeSelectContentProps {
  action: TodoScopeAction;
  onChange: (scope: TodoEditScope) => void;
}

export function TodoScopeSelectContent({ action, onChange }: TodoScopeSelectContentProps) {
  const { t } = useTranslation('todo');

  return (
    <VStack gap={8} testID="todo-scope-select">
      <Text size="b2" weight="semibold" tone="neutral" shade={8} align="center" className="py-2">
        {action === 'edit' ? t('scope.editTitle') : t('scope.deleteTitle')}
      </Text>
      {action === 'edit' ? (
        <>
          <ScopeRow label={t('scope.editTHIS_ONLY')} onPress={() => onChange('THIS_ONLY')} />
          <ScopeRow
            label={t('scope.editTHIS_AND_FOLLOWING')}
            onPress={() => onChange('THIS_AND_FOLLOWING')}
          />
        </>
      ) : (
        <>
          <ScopeRow label={t('scope.deleteTHIS_ONLY')} onPress={() => onChange('THIS_ONLY')} />
          <ScopeRow
            label={t('scope.deleteTHIS_AND_FOLLOWING')}
            onPress={() => onChange('THIS_AND_FOLLOWING')}
          />
          <ScopeRow isDanger label={t('scope.deleteALL')} onPress={() => onChange('ALL')} />
          <Text
            size="b4"
            tone="neutral"
            shade={6}
            className="px-4"
            lineBreakStrategyIOS="hangul-word"
          >
            {t('scope.deleteAllHint')}
          </Text>
        </>
      )}
    </VStack>
  );
}
