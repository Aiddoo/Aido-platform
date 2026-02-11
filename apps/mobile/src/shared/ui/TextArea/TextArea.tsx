import { cn } from '@src/shared/utils/cn';
import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';
import { Text } from '../Text/Text';
import type { TextAreaProps } from './TextArea.types';
import {
  textAreaContainerVariants,
  textAreaLabelVariants,
  textAreaTextVariants,
} from './TextArea.variants';

const StyledTextInput = withUniwind(TextInput);

export const TextArea = forwardRef<TextInput, TextAreaProps>(
  (
    {
      variant = 'filled',
      label,
      isDisabled = false,
      isInvalid = false,
      errorMessage,
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
          <Text
            size="e1"
            weight="medium"
            className={textAreaLabelVariants({ isFocused, isInvalid })}
          >
            {label}
          </Text>
        )}
        <View
          className={cn(
            textAreaContainerVariants({ variant, isFocused, isDisabled, isInvalid }),
            className,
          )}
        >
          <StyledTextInput
            ref={ref}
            placeholder={placeholder}
            editable={!isDisabled}
            multiline
            textAlignVertical="top"
            className={textAreaTextVariants()}
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

TextArea.displayName = 'TextArea';
