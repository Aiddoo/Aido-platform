import { cn } from '@src/shared/utils/cn';
import { Menu } from 'heroui-native';
import type { ComponentProps } from 'react';

type MenuContentProps = Omit<
  Extract<ComponentProps<typeof Menu.Content>, { presentation: 'popover' }>,
  'presentation'
>;

export function MenuContent({ className, children, ...contentProps }: MenuContentProps) {
  return (
    <Menu.Portal disableFullWindowOverlay={false}>
      <Menu.Overlay />
      <Menu.Content
        presentation="popover"
        placement="bottom"
        align="end"
        className={cn('rounded-2xl border border-gray-2 bg-gray-1', className)}
        {...contentProps}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}
