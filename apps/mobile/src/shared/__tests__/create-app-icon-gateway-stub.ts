import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';

/** 기본은 지원하는 기기에서 기본 아이콘을 쓰는 상태다. 바꾸면 요청한 이름을 그대로 돌려준다 */
export const createAppIconGatewayStub = (): jest.Mocked<AppIconGateway> => ({
  isSupported: jest.fn().mockReturnValue(true),
  getCurrentIcon: jest.fn().mockResolvedValue(null),
  changeIcon: jest.fn().mockImplementation(async (name: string | null) => name),
});
