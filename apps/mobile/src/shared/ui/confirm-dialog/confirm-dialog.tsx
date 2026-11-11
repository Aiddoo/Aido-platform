import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { usePortalTarget } from '@src/shared/ui/bottom-sheet';
import { Box } from '@src/shared/ui/box';
import { Button, type ButtonProps } from '@src/shared/ui/button';
import { HStack } from '@src/shared/ui/h-stack';
import { READABLE_CONTENT_MAX_WIDTH } from '@src/shared/ui/readable-content';
import { H4, Text } from '@src/shared/ui/text';
import { VStack } from '@src/shared/ui/v-stack';
import { WordWrapText } from '@src/shared/ui/word-wrap-text';
import { Dialog } from 'heroui-native';
import type { ReactNode } from 'react';

import type { ConfirmDialogProps } from './confirm-dialog.types';

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelButton,
  confirmButton,
  secondaryButton,
}: ConfirmDialogProps) {
  const portalTarget = usePortalTarget();

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal {...portalTarget}>
        <Dialog.Overlay className="bg-black/40" />
        {/* 태블릿·펼친 폴더블에서도 창 폭만큼 늘어나지 않고 읽기 폭에서 멈춘다 */}
        <Dialog.Content
          className="w-full self-center"
          style={{ maxWidth: READABLE_CONTENT_MAX_WIDTH }}
        >
          <VStack gap={16}>
            <VStack gap={6}>
              {title}
              {description}
            </VStack>
            <ConfirmDialogActions
              cancelButton={cancelButton}
              confirmButton={confirmButton}
              secondaryButton={secondaryButton}
            />
          </VStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

type ConfirmDialogActionsProps = Pick<
  ConfirmDialogProps,
  'cancelButton' | 'confirmButton' | 'secondaryButton'
>;

function ConfirmDialogActions({
  cancelButton,
  confirmButton,
  secondaryButton,
}: ConfirmDialogActionsProps) {
  const { fontScale } = useFontScale();

  if (secondaryButton != null) {
    return (
      <VStack gap={8} className="w-full">
        <Box className="w-full">{confirmButton}</Box>
        <Box className="w-full">{secondaryButton}</Box>
        {cancelButton != null && <Box className="w-full">{cancelButton}</Box>}
      </VStack>
    );
  }
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

ConfirmDialog.CancelButton = function CancelButton({
  variant = 'weak',
  color = 'dark',
  size = 'large',
  display = 'inline',
  ...rest
}: ButtonProps) {
  return <Button variant={variant} color={color} size={size} display={display} {...rest} />;
};

ConfirmDialog.ConfirmButton = function ConfirmButton({
  variant = 'fill',
  color = 'primary',
  size = 'large',
  display = 'inline',
  ...rest
}: ButtonProps) {
  return <Button variant={variant} color={color} size={size} display={display} {...rest} />;
};
