import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 이 기기에서 위치를 허용한 적이 있는지. Mac은 앱을 켠 직후 허용 전으로 읽히기도 해 다시 확인할 근거로 쓴다 */
export const weatherLocationPermissionGrantedStoredValue = defineStoredValue({
  key: 'aido_weather_location_permission_granted_v1',
  schema: storedJsonSchema(z.boolean()),
  fallback: false,
});
