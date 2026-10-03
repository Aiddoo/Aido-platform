import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';
import * as AppIcon from 'expo-quick-actions/icon';

export const expoAppIconGateway: AppIconGateway = {
  isSupported: () => AppIcon.isSupported && !!AppIcon.getIcon && !!AppIcon.setIcon,
  getCurrentIcon: async () => {
    if (!AppIcon.getIcon) throw new Error('App icon module is unavailable');
    return AppIcon.getIcon();
  },
  changeIcon: async (name) => {
    if (!AppIcon.setIcon) throw new Error('App icon module is unavailable');
    return AppIcon.setIcon(name);
  },
};
