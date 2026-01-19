/**
 * DI Container
 *
 * 구현체 생성 및 바인딩을 담당합니다.
 * "어떤 구현체를 쓸지" 결정하는 곳입니다.
 */

import { AuthRepositoryImpl } from '@src/features/auth/data/repositories/auth.repository.impl';
import { KyHttpClient } from '@src/shared/api/http-client.impl';

// ===== Infrastructure =====

/**
 * HTTP 클라이언트 (싱글톤)
 */
export const httpClient = new KyHttpClient();

// ===== Repository Bindings =====

/**
 * Auth Repository 구현체
 */
export const authRepository = new AuthRepositoryImpl(httpClient);
