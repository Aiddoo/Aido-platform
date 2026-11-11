import { describeUserReportRepositoryContract } from "#test/contracts/social/user-report-repository.contract";
import { InMemoryUserReportRepository } from "#test/doubles/social/in-memory-user-report.repository";
import {
  USER_REPORT_FIXTURE_REPORTER_ID,
  USER_REPORT_FIXTURE_REPORTER_TAG,
  USER_REPORT_FIXTURE_TARGET_USER_ID,
  USER_REPORT_FIXTURE_TARGET_USER_TAG,
} from "#test/fixtures/social/user-report.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeUserReportRepositoryContract(
  async () =>
    new InMemoryUserReportRepository({
      activeUserTags: {
        [USER_REPORT_FIXTURE_REPORTER_ID]: USER_REPORT_FIXTURE_REPORTER_TAG,
        [USER_REPORT_FIXTURE_TARGET_USER_ID]: USER_REPORT_FIXTURE_TARGET_USER_TAG,
      },
    }),
);
