import { AiUsagePolicy } from '@src/features/todo/models/todo.model';
import { useGetAiUsageQueryOptions } from '@src/features/todo/presentations/queries/use-get-ai-usage-query-options';
import { ConfirmDialog, Text, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

interface AiParseConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AiParseConfirmDialog({ isOpen, onClose, onConfirm }: AiParseConfirmDialogProps) {
  const { data: aiUsage } = useQuery(useGetAiUsageQueryOptions());
  const router = useRouter();

  if (!aiUsage) return null;

  const remaining = AiUsagePolicy.getRemainingCount(aiUsage);

  if (remaining === 0) {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={<ConfirmDialog.Title>오늘 AI 파싱 횟수를 모두 사용했어요</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            구독하면 무제한으로 사용할 수 있어요
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={onClose}>닫기</ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onPress={() => router.replace('/settings/subscription')}>
            구독하기
          </ConfirmDialog.ConfirmButton>
        }
      />
    );
  }

  const warningText =
    remaining != null
      ? '파싱 중 화면을 벗어나면 결과를 받을 수 없고 횟수가 차감돼요.'
      : '파싱 중 화면을 벗어나면 결과를 받을 수 없어요.';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={<ConfirmDialog.Title>AI로 메모를 할 일로 만들게요</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          <VStack className="gap-1.5">
            {remaining != null && (
              <Text size="b3" shade={7}>
                오늘 {remaining}/{aiUsage.limit}회 사용할 수 있어요
              </Text>
            )}
            <Text size="e1" shade={6}>
              {warningText}
            </Text>
          </VStack>
        </ConfirmDialog.Description>
      }
      cancelButton={<ConfirmDialog.CancelButton onPress={onClose}>닫기</ConfirmDialog.CancelButton>}
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onConfirm}>시작하기</ConfirmDialog.ConfirmButton>
      }
    />
  );
}
