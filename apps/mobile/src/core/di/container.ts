import { AuthRepositoryImpl } from '@src/features/auth/data/repositories/auth.repository.impl';
import { KyHttpClient } from '@src/shared/api/http-client.impl';

export const httpClient = new KyHttpClient();
export const authRepository = new AuthRepositoryImpl(httpClient);
