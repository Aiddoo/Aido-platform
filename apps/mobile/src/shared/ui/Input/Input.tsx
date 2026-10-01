import { cn } from '@src/shared/utils/cn';
import type {
  ComponentRef,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from 'react';
import { forwardRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { Text } from '../Text/Text';
import type { InputInternalProps } from './Input.types';
import { inputContainerVariants, inputLabelVariants, inputTextVariants } from './Input.variants';

const StyledTextInput = withUniwind(TextInput);

export const Input: ForwardRefExoticComponent<
  PropsWithoutRef<InputInternalProps> & RefAttributes<ComponentRef<typeof TextInput>>
> = forwardRef<ComponentRef<typeof TextInput>, InputInternalProps>(
  (
    {
      variant = 'filled',
      size = 'large',
      label,
      isDisabled = false,
      isInvalid = false,
      errorMessage,
      renderErrorMessage = true,
      leftContent,
      rightContent,
      placeholder,
      className,
      value,
      onChange,
      onFocus,
      onBlur,
      textInputComponent: InputComp = StyledTextInput,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View className="gap-1">
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
          <InputComp
            ref={ref}
            value={value}
            onChangeText={onChange}
            allowFontScaling={false}
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
        {renderErrorMessage && (
          <Text size="e1" className={cn('ml-1', errorMessage ? 'text-error' : 'opacity-0')}>
            {errorMessage || ' '}
          </Text>
        )}
      </View>
    );
  },
);

Input.displayName = 'Input';
