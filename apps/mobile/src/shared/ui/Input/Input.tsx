import { cn } from '@src/shared/utils/cn';
import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';
import { Text } from '../Text/Text';
import type { InputProps } from './Input.types';
import { inputContainerVariants, inputLabelVariants, inputTextVariants } from './Input.variants';

const StyledTextInput = withUniwind(TextInput);

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      variant = 'filled',
      size = 'large',
      label,
      isDisabled = false,
      isInvalid = false,
      errorMessage,
      leftContent,
      rightContent,
      placeholder,
      className,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View className="gap-2">
        {label && (
          <Text size="e1" weight="medium" className={inputLabelVariants({ isFocused, isInvalid })}>
            {label}
          </Text>
        )}
        <View
          className={cn(
            inputContainerVariants({ variant, size, isFocused, isDisabled, isInvalid }),
            className,
          )}
        >
          {leftContent && <View className="mr-3">{leftContent}</View>}
          <StyledTextInput
            ref={ref}
            placeholder={placeholder}
            editable={!isDisabled}
            className={inputTextVariants({ size, hasLeftContent: !!leftContent })}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {rightContent && <View className="ml-3">{rightContent}</View>}
        </View>
        {errorMessage && (
          <Text size="e1" className="text-error">
            {errorMessage}
          </Text>
        )}
      </View>
    );
  },
);

Input.displayName = 'Input';
