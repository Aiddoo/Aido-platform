import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Box } from '@src/shared/ui/box';
import { Button, type ButtonProps } from '@src/shared/ui/button';
import { HStack } from '@src/shared/ui/h-stack';
import { H4, Text } from '@src/shared/ui/text';
import { VStack } from '@src/shared/ui/v-stack';
import { Dialog } from 'heroui-native';
import { cloneElement, isValidElement, type ReactNode } from 'react';

import type { ConfirmDialogProps } from './confirm-dialog.types';

const asFullWidthAction = (action: ReactNode): ReactNode =>
  isValidElement<ButtonProps>(action) ? cloneElement(action, { display: 'full' }) : action;

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelButton,
  confirmButton,
}: ConfirmDialogProps) {
  const { fontScale } = useFontScale();
  const stackActions = fontScale === 'xlarge' && Boolean(cancelButton);
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/40" />
        <Dialog.Content>
          <VStack gap={16}>
            <VStack gap={6}>
              {title}
              {description}
            </VStack>
            {cancelButton && stackActions ? (
              <VStack gap={8} className="w-full">
                <Box className="w-full">{asFullWidthAction(confirmButton)}</Box>
                <Box className="w-full">{asFullWidthAction(cancelButton)}</Box>
              </VStack>
            ) : cancelButton ? (
              <HStack gap={8} className="w-full">
                <Box className="flex-1">{cancelButton}</Box>
                <Box className="flex-1">{confirmButton}</Box>
              </HStack>
            ) : (
              <HStack className="w-full justify-end">{confirmButton}</HStack>
            )}
          </VStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

ConfirmDialog.Title = function Title({ children }: { children: ReactNode }) {
  return (
    <Dialog.Title>
      <H4>{children}</H4>
    </Dialog.Title>
  );
};

ConfirmDialog.Description = function Description({ children }: { children: ReactNode }) {
  return (
    <Dialog.Description>
      <Text size="b3" shade={6}>
        {children}
      </Text>
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
