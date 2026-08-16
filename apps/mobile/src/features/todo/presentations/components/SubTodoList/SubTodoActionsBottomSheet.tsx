import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  BottomSheet,
  Box,
  EditIcon,
  ListRow,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

interface SubTodoActionsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<unknown> | void;
}

export const SubTodoActionsBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  onEdit,
  onDelete,
}: SubTodoActionsBottomSheetProps) => {
  const { t } = useTranslation('todo');

  // 지우는 동안의 상태는 이 시트가 스스로 안다 — 오버레이는 열릴 때의 화면을 스냅샷으로
  // 들고 있어서, 밖에서 넘긴 진행 중 플래그는 갱신되지 않고 얼어붙는다.
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={8}>
        <PressableFeedback
          onPress={() => {
            onEdit();
            onClose();
          }}
          isDisabled={isDeleting}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-gray-2">
                <EditIcon width={16} height={16} colorClassName="text-gray-7" />
              </Box>
            }
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('actions.edit')} topProps={{ size: 'b2' }} />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />}
          />
        </PressableFeedback>

        <PressableFeedback onPress={handleDelete} isDisabled={isDeleting}>
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={
              <Box className="size-7 items-center justify-center rounded-full bg-error/10 dark:bg-error/20">
                <TrashIcon width={16} height={16} colorClassName="text-error" />
              </Box>
            }
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={isDeleting ? t('actions.deleting') : t('actions.delete')}
                topProps={{ size: 'b2', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
      </VStack>
    </BottomSheet>
  );
};
