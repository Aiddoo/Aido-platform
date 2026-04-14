import { AiUsagePolicy } from '@src/features/todo/models/todo.model';
import { useGetAiUsageQueryOptions } from '@src/features/todo/presentations/queries/use-get-ai-usage-query-options';
import { ConfirmDialog, Text, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

interface AiParseConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AiParseConfirmDialog({ isOpen, onClose, onConfirm }: AiParseConfirmDialogProps) {
  const { data: aiUsage } = useQuery(useGetAiUsageQueryOptions());

  if (!aiUsage) return null;

  const remaining = AiUsagePolicy.getRemainingCount(aiUsage);
  const usageText =
    remaining != null
      ? `오늘 사용 가능한 횟수: ${remaining}/${aiUsage.limit}회`
      : '프리미엄 구독 중이라 무제한으로 사용할 수 있어요';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={<ConfirmDialog.Title>AI 파싱</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          <VStack className="gap-1.5">
            <Text size="b3" shade={7}>
              {usageText}
            </Text>
            <Text size="e1" shade={6}>
              파싱 중 화면을 벗어나면 횟수만 차감될 수 있어요.
            </Text>
          </VStack>
        </ConfirmDialog.Description>
      }
      cancelButton={<ConfirmDialog.CancelButton onPress={onClose}>취소</ConfirmDialog.CancelButton>}
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onConfirm}>시작하기</ConfirmDialog.ConfirmButton>
      }
    />
  );
}
