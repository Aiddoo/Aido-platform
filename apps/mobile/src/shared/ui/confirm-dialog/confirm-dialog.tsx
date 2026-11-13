import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Dialog } from 'heroui-native';
import { type ReactNode, useState } from 'react';

import { usePortalTarget } from '../bottom-sheet/portal-target';
import { Box } from '../box/box';
import { Button } from '../button/button';
import { HStack } from '../h-stack/h-stack';
import { READABLE_CONTENT_MAX_WIDTH } from '../readable-content/readable-content';
import { Text } from '../text/text';
import { H4 } from '../text/typography';
import { VStack } from '../v-stack/v-stack';
import { WordWrapText } from '../word-wrap-text/word-wrap-text';
import type { ConfirmDialogProps } from './confirm-dialog.types';

/** 진행 상태를 스스로 갖는다. overlay로 띄우면 열 때의 화면이 굳고, route가 그리면 내용이 그대로 바뀐다 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmColor = 'primary',
  cancelLabel,
  confirmTestID,
  isConfirmDisabled = false,
  onConfirm,
  isOpen,
  onFinish,
}: ConfirmDialogProps) {
  const portalTarget = usePortalTarget();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (onConfirm == null) {
      onFinish(true);
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
      onFinish(true);
    } catch {
      // 실패 안내·보고는 onConfirm의 mutation 전역 피드백이 이미 했다. 다이얼로그를 남겨 다시 누르거나 취소하게 한다
      setIsConfirming(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isConfirming) {
          onFinish(false);
        }
      }}
    >
      <Dialog.Portal {...portalTarget}>
        <Dialog.Overlay className="bg-black/40" />
        {/* 태블릿·펼친 폴더블에서도 창 폭만큼 늘어나지 않고 읽기 폭에서 멈춘다 */}
        <Dialog.Content
          className="w-full self-center"
          style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}
        >
          <VStack gap={16}>
            <VStack gap={6}>
              <ConfirmDialog.Title>{title}</ConfirmDialog.Title>
              {description != null && (
                <ConfirmDialog.Description>{description}</ConfirmDialog.Description>
              )}
            </VStack>
            <ConfirmDialog.Actions
              cancelButton={
                cancelLabel == null ? undefined : (
                  <Button
                    variant="weak"
                    color="dark"
                    size="large"
                    display="inline"
                    isDisabled={isConfirming}
                    onPress={() => onFinish(false)}
                  >
                    {cancelLabel}
                  </Button>
                )
              }
              confirmButton={
                <Button
                  testID={confirmTestID}
                  variant="fill"
                  color={confirmColor}
                  size="large"
                  display="inline"
                  isDisabled={isConfirmDisabled}
                  isLoading={isConfirming}
                  onPress={handleConfirm}
                >
                  {confirmLabel}
                </Button>
              }
            />
          </VStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

// HeroUI Title·Description은 Text라 안쪽 글자는 중첩 Text가 된다. iOS는 바깥 Text의 줄바꿈 규칙만 따라 규칙을 바깥에 준다
ConfirmDialog.Title = function Title({ children }: { children: ReactNode }) {
  return (
    <Dialog.Title lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
      <H4>{children}</H4>
    </Dialog.Title>
  );
};

ConfirmDialog.Description = function Description({ children }: { children: ReactNode }) {
  return (
    <Dialog.Description lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
      {typeof children === 'string' ? (
        <WordWrapText size="b3" shade={6}>
          {children}
        </WordWrapText>
      ) : (
        <Text size="b3" shade={6}>
          {children}
        </Text>
      )}
    </Dialog.Description>
  );
};

interface ActionsProps {
  cancelButton?: ReactNode;
  confirmButton: ReactNode;
}

ConfirmDialog.Actions = function Actions({ cancelButton, confirmButton }: ActionsProps) {
  const { fontScale } = useFontScale();

  if (cancelButton == null) {
    return <HStack className="w-full justify-end">{confirmButton}</HStack>;
  }
  if (fontScale === 'xlarge') {
    return (
      <VStack gap={8} className="w-full">
        <Box className="w-full">{confirmButton}</Box>
        <Box className="w-full">{cancelButton}</Box>
      </VStack>
    );
  }
  return (
    <HStack gap={8} className="w-full">
      <Box className="flex-1">{cancelButton}</Box>
      <Box className="flex-1">{confirmButton}</Box>
    </HStack>
  );
};
