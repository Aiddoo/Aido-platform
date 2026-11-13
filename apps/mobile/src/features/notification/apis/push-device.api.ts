import {
  pushDeviceResponseSchema,
  type UnregisterPushDeviceByTokenInput,
  unregisterPushDeviceByTokenResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import type { PushPermission } from '../domains/push-permission.model';
import { toPushDevice, toReportPushDeviceRequest } from './push-device.mapper';

interface PushDeviceApiPorts {
  authHttpClient: HttpClient;
  /** 끝난 세션의 해제는 인증 없이 보낸다. 인증 클라이언트는 401에 지금 세션을 끝낸다 */
  publicHttpClient: Pick<HttpClient, 'post'>;
}

export class PushDeviceApi {
  readonly #authHttpClient: HttpClient;
  readonly #publicHttpClient: Pick<HttpClient, 'post'>;

  constructor({ authHttpClient, publicHttpClient }: PushDeviceApiPorts) {
    this.#authHttpClient = authHttpClient;
    this.#publicHttpClient = publicHttpClient;
  }

  report = async (deviceId: string, values: { permission: PushPermission; token: string | null }) =>
    parseApiResponse(
      await this.#authHttpClient.put(
        `v1/notifications/push-devices/${deviceId}`,
        toReportPushDeviceRequest(values),
      ),
      pushDeviceResponseSchema,
      toPushDevice,
      '[PushDeviceApi] Invalid reportPushDevice response',
    );

  unregister = async (
    deviceId: string,
    config?: Pick<RequestConfig, 'timeout'>,
  ): Promise<Result<void, ApiError>> => {
    const result = await this.#authHttpClient.delete('v1/notifications/token', {
      ...config,
      params: { deviceId },
    });
    return result.ok ? ok(undefined) : result;
  };

  release = async (input: UnregisterPushDeviceByTokenInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/notifications/push-devices/unregister', input),
      unregisterPushDeviceByTokenResponseSchema,
      noop,
      '[PushDeviceApi] Invalid unregisterPushDeviceByToken response',
    );
}
