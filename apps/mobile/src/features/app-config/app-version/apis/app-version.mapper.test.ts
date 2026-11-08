import { appVersionResponseSchema } from '@aido/api';

import { appVersionConfigSchema } from '../domains/app-version.model';
import { toAppVersionConfig } from './app-version.mapper';

describe('toAppVersionConfig', () => {
  it('점검이 꺼진 응답은 안내하지 않는 모델로 바꾼다', () => {
    // Given
    const dto = appVersionResponseSchema.parse({ enabled: false });

    // When
    const config = toAppVersionConfig(dto);

    // Then
    expect(appVersionConfigSchema.parse(config)).toEqual({ enabled: false });
  });

  it('점검이 켜진 응답은 플랫폼별 최신 버전만 모델로 옮긴다', () => {
    // Given
    const dto = appVersionResponseSchema.parse({
      enabled: true,
      ios: { latestVersion: '1.15.0' },
      android: { latestVersion: '1.14.2' },
    });

    // When
    const config = toAppVersionConfig(dto);

    // Then
    expect(appVersionConfigSchema.parse(config)).toEqual({
      enabled: true,
      latestByPlatform: { ios: '1.15.0', android: '1.14.2' },
    });
  });
});
