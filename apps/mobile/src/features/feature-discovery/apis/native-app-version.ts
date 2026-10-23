import * as Application from 'expo-application';

/** 네이티브 바이너리 버전을 알 수 없으면 자동 노출을 fail closed 한다. */
export const getNativeAppVersion = (): string | undefined =>
  Application.nativeApplicationVersion ?? undefined;
