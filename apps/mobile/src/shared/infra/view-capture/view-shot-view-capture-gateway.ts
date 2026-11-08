import type { ViewCaptureGateway } from '@src/core/ports/view-capture-gateway';

export const viewShotViewCaptureGateway: ViewCaptureGateway = {
  capture: async (handle) => (await handle?.capture()) ?? null,
};
