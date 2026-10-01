import type { Widget } from 'expo-widgets';

import type { WidgetProps } from '../models/widget-props.model';

export const aidoWidgets: readonly { widget: Widget<WidgetProps>; maxRows: number }[] = [];
