import { clsx } from 'clsx';
import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Text } from '../Text/Text';
import type { InputProps } from './Input.types';
import { inputContainerVariants, inputLabelVariants } from './Input.variants';

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
          className={clsx(
            inputContainerVariants({ variant, size, isFocused, isDisabled, isInvalid }),
            className,
          )}
        >
          {leftContent && <View className="mr-3">{leftContent}</View>}
          <TextInput
            ref={ref}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            editable={!isDisabled}
            className={clsx('flex-1 text-gray-8', !leftContent && 'pl-0')}
            style={{ fontSize: size === 'large' ? 16 : 14 }}
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
