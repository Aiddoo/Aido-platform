import { ErrorCode } from '@aido/api/errors';
import { ApiError, NetworkError } from '@src/shared/errors';

import { isReportTargetUnavailableError } from './moderation.error';

describe('isReportTargetUnavailableError', () => {
  it('신고 대상이 사라진 서버 오류는 다시 시도할 수 없다고 본다', () => {
    // Given
    const error = new ApiError(ErrorCode.REPORT_2252, '대상 없음', 404);

    // When
    const result = isReportTargetUnavailableError(error);

    // Then
    expect(result).toBe(true);
  });

  it('다른 서버 오류는 다시 시도할 수 있다고 본다', () => {
    // Given
    const error = new ApiError('MEMO_2001', '한도 초과', 409);

    // When
    const result = isReportTargetUnavailableError(error);

    // Then
    expect(result).toBe(false);
  });

  it('연결이 끊긴 오류는 다시 시도할 수 있다고 본다', () => {
    // Given
    const error = new NetworkError();

    // When
    const result = isReportTargetUnavailableError(error);

    // Then
    expect(result).toBe(false);
  });
});
