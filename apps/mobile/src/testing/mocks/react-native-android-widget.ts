// 네이티브 위젯 모듈 mock (jest.config.js moduleNameMapper에서 매핑)
export const FlexWidget = 'FlexWidget';
export const ListWidget = 'ListWidget';
export const TextWidget = 'TextWidget';
export const SvgWidget = 'SvgWidget';
export const requestWidgetUpdate = jest.fn();
export const registerWidgetTaskHandler = jest.fn();
