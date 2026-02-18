import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { ArrowRightIcon, ClockIcon, EditIcon, TrashIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TodoActionsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRequestClose: () => void;
  onEdit: () => void;
  onUpdateDateTime: () => void;
  onDelete: () => void;
  isDeletePending?: boolean;
}

export const TodoActionsBottomSheet = ({
  isOpen,
  onOpenChange,
  onRequestClose,
  onEdit,
  onUpdateDateTime,
  onDelete,
  isDeletePending = false,
}: TodoActionsBottomSheetProps) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack mb={insets.bottom} gap={8}>
        <PressableFeedback
          onPress={() => {
            onEdit();
            onRequestClose();
          }}
          isDisabled={isDeletePending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={<EditIcon width={18} height={18} colorClassName="text-gray-6" />}
            contents={<ListRow.Texts type="1RowTypeA" top="수정하기" topProps={{ size: 'b3' }} />}
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-8" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            onUpdateDateTime();
            onRequestClose();
          }}
          isDisabled={isDeletePending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={<ClockIcon width={18} height={18} colorClassName="text-gray-6" />}
            contents={
              <ListRow.Texts type="1RowTypeA" top="날짜/시간 변경" topProps={{ size: 'b3' }} />
            }
            right={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-8" />}
          />
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            onDelete();
            onRequestClose();
          }}
          isDisabled={isDeletePending}
        >
          <ListRow
            horizontalPadding="medium"
            verticalPadding="medium"
            left={<TrashIcon width={18} height={18} colorClassName="text-error" />}
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={isDeletePending ? '삭제 중...' : '삭제하기'}
                topProps={{ size: 'b3', tone: 'danger' }}
              />
            }
          />
        </PressableFeedback>
      </VStack>
    </KeyboardBottomSheet>
  );
};
