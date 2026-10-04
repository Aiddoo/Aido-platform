import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

import { androidWidgetTaskHandler } from './android-widget-task-handler';

export function registerWidgetTaskHandler(): void {
  registerNativeWidgetTaskHandler(androidWidgetTaskHandler);
}
