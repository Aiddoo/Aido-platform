import type { ComponentType } from 'react';

/**
 * jest 환경용 @sentry/react-native 목. SDK는 ESM이라 jest가 읽지 못한다.
 * `init`한 뒤에만 `getClient`가 값을 주어 초기화 여부를 테스트가 읽는다.
 */
let client: object | undefined;

export const init = jest.fn(() => {
  client = {};
});
export const getClient = jest.fn(() => client);
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const addBreadcrumb = jest.fn();
export const setUser = jest.fn();
export const mobileReplayIntegration = jest.fn();
export const wrap = <Props>(component: ComponentType<Props>) => component;

export function resetSentryClient() {
  client = undefined;
}
