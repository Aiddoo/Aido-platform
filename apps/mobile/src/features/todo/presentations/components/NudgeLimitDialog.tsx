import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { H4 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Dialog } from 'heroui-native';

interface NudgeLimitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NudgeLimitDialog({ isOpen, onOpenChange }: NudgeLimitDialogProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/40" />
        <Dialog.Content>
          <VStack gap={16}>
            <VStack gap={6}>
              <Dialog.Title>
                <H4>오늘 콕 찌르기를 다 했어요</H4>
              </Dialog.Title>
              <Dialog.Description>
                <Text size="b3" shade={6}>
                  구독하면 무제한으로 찌를 수 있어요
                </Text>
              </Dialog.Description>
            </VStack>
            <HStack gap={8} className="w-full" justify="center">
              <Button
                variant="weak"
                color="dark"
                size="large"
                display="inline"
                className="flex-1"
                onPress={() => onOpenChange(false)}
              >
                닫기
              </Button>
              <Button
                size="large"
                display="inline"
                className="flex-1"
                onPress={() => {
                  //TODO: 구독하기로 이동
                  onOpenChange(false);
                }}
              >
                구독하기
              </Button>
            </HStack>
          </VStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
