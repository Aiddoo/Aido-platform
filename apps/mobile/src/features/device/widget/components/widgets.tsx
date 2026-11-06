import type { Widget } from 'expo-widgets';

import type { WidgetProps } from '../schemas/widget-props.schema';

export const AIDO_WIDGETS: readonly { widget: Widget<WidgetProps>; maxRows: number }[] = [];
