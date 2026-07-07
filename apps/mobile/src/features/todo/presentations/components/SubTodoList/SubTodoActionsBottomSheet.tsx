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

interface SubTodoActionsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const SubTodoActionsBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
}: SubTodoActionsBottomSheetProps) => {
  const { t } = useTranslation('todo');
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

        <PressableFeedback onPress={onDelete} isDisabled={isDeleting}>
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
