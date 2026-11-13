// SwiftUI modifier mock (jest.config.js moduleNameMapper에서 매핑)
export const containerBackground = jest.fn();
export const background = jest.fn();
export const cornerRadius = jest.fn();
export const font = jest.fn();
export const foregroundStyle = jest.fn();
export const frame = jest.fn();
export const gaugeStyle = jest.fn();
export const lineLimit = jest.fn();
export const monospacedDigit = jest.fn();
export const minimumScaleFactor = jest.fn();
export const strikethrough = jest.fn();
export const opacity = jest.fn();
export const padding = jest.fn();
export const tint = jest.fn();
export const widgetURL = (url: string) => ({ $type: 'widgetURL', url });
