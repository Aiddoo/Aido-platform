import { Button } from '@src/shared/ui/Button/Button';
import type { ButtonProps } from '@src/shared/ui/Button/Button.types';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { H4 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Dialog } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelButton,
  confirmButton,
}: ConfirmDialogProps) {
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
            {cancelButton ? (
              <HStack gap={8} className="w-full">
                <View className="flex-1">{cancelButton}</View>
                <View className="flex-1">{confirmButton}</View>
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
