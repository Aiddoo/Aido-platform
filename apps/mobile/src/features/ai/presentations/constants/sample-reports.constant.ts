import type { AiReport } from '../../models/ai.model';

export const SAMPLE_WEEKLY_REPORT: AiReport = {
  id: -1,
  type: 'WEEKLY',
  year: 2026,
  period: 10,
  periodLabel: '2026년 10주차',
  dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
  stats: {
    totalTodos: 35,
    completedTodos: 29,
    completionRate: 83,
    prevCompletionRate: 76,
    streakDays: 5,
  },
  categoryBreakdown: [
    { name: '업무 프로젝트', color: '#FF6B6B', total: 12, completed: 11, rate: 92 },
    { name: '자기개발', color: '#4ECDC4', total: 7, completed: 6, rate: 86 },
    { name: '건강·운동', color: '#45B7D1', total: 7, completed: 5, rate: 71 },
    { name: '생활관리', color: '#FFD93D', total: 5, completed: 4, rate: 80 },
    { name: '사이드 프로젝트', color: '#6C5CE7', total: 4, completed: 3, rate: 75 },
  ],
  dayPatterns: [
    { day: 'MON', total: 6, completed: 6, rate: 100 },
    { day: 'TUE', total: 6, completed: 5, rate: 83 },
    { day: 'WED', total: 5, completed: 3, rate: 60 },
    { day: 'THU', total: 5, completed: 5, rate: 100 },
    { day: 'FRI', total: 5, completed: 4, rate: 80 },
    { day: 'SAT', total: 4, completed: 3, rate: 75 },
    { day: 'SUN', total: 4, completed: 3, rate: 75 },
  ],
  timePatterns: [
    { hour: 9, count: 9 },
    { hour: 19, count: 7 },
    { hour: 7, count: 5 },
    { hour: 14, count: 4 },
    { hour: 22, count: 3 },
    { hour: 12, count: 2 },
  ],
  aiSummary:
    '업무 프로젝트 달성률 92%로 이번 주 가장 집중한 카테고리예요. 퇴근 후 자기개발 루틴이 자리 잡아가고 있고, 5일 연속 달성 중이에요! 다만 수요일에 달성률이 눈에 띄게 떨어졌어요.',
  aiTips: [
    '수요일마다 달성률이 낮아지는 패턴이 보여요. 수요일은 할 일을 3~4개로 줄여보면 달성률이 올라갈 거예요.',
    '오전 9시와 퇴근 후 7시가 가장 활발한 시간이에요. 중요한 할 일은 이 시간에 배치해보세요.',
    '건강·운동 카테고리가 71%로 다른 카테고리보다 낮아요. 운동 시간을 미리 캘린더에 잡아두면 꾸준히 하기 쉬워져요.',
    '5일 연속 달성 중! 주말까지 이어가면 7일 연속 달성 뱃지를 받을 수 있어요.',
  ],
  hasActivity: true,
  generatedAt: new Date('2026-03-09T00:00:00.000Z'),
};

export const SAMPLE_MONTHLY_REPORT: AiReport = {
  id: -2,
  type: 'MONTHLY',
  year: 2026,
  period: 2,
  periodLabel: '2026년 2월',
  dateRange: { startDate: '2026-02-01', endDate: '2026-02-28' },
  stats: {
    totalTodos: 156,
    completedTodos: 128,
    completionRate: 82,
    prevCompletionRate: 74,
    streakDays: 9,
  },
  categoryBreakdown: [
    { name: '업무 프로젝트', color: '#FF6B6B', total: 54, completed: 49, rate: 91 },
    { name: '자기개발', color: '#4ECDC4', total: 32, completed: 27, rate: 84 },
    { name: '건강·운동', color: '#45B7D1', total: 28, completed: 21, rate: 75 },
    { name: '생활관리', color: '#FFD93D', total: 24, completed: 19, rate: 79 },
    { name: '사이드 프로젝트', color: '#6C5CE7', total: 18, completed: 12, rate: 67 },
  ],
  dayPatterns: [
    { day: 'MON', total: 25, completed: 22, rate: 88 },
    { day: 'TUE', total: 24, completed: 21, rate: 88 },
    { day: 'WED', total: 23, completed: 17, rate: 74 },
    { day: 'THU', total: 23, completed: 20, rate: 87 },
    { day: 'FRI', total: 22, completed: 18, rate: 82 },
    { day: 'SAT', total: 20, completed: 15, rate: 75 },
    { day: 'SUN', total: 19, completed: 15, rate: 79 },
  ],
  timePatterns: [
    { hour: 9, count: 38 },
    { hour: 19, count: 28 },
    { hour: 14, count: 22 },
    { hour: 7, count: 18 },
    { hour: 22, count: 14 },
    { hour: 12, count: 10 },
  ],
  aiSummary:
    '2월 한 달간 82% 달성률을 기록했어요. 지난달(74%)보다 8%p 올랐어요! 업무 프로젝트 달성률이 91%로 가장 높았고, 월초에 세운 자기개발 루틴이 점점 습관으로 자리 잡고 있어요. 셋째 주에 달성률이 살짝 주춤했지만 넷째 주에 다시 회복한 점이 인상적이에요.',
  aiTips: [
    '월간 목표를 주간 단위로 쪼개면 부담이 줄어들어요. 이번 달 자기개발 목표를 주 8개씩 나눠보세요.',
    '수요일 달성률이 74%로 매주 가장 낮아요. 주 중반 리프레시 루틴(산책, 짧은 명상)을 넣어보면 집중력 회복에 도움이 될 거예요.',
    '사이드 프로젝트 달성률이 67%로 아쉬워요. 주말 오전에 2시간 블록을 확보하면 꾸준히 진행할 수 있어요.',
    '9일 연속 달성 기록이 있어요! 다음 달에는 14일 연속에 도전해보는 건 어떨까요?',
  ],
  hasActivity: true,
  generatedAt: new Date('2026-03-01T00:00:00.000Z'),
};

/** 샘플 route param → AiReport 매핑 */
export const SAMPLE_REPORTS: Record<string, AiReport> = {
  'sample-weekly': SAMPLE_WEEKLY_REPORT,
  'sample-monthly': SAMPLE_MONTHLY_REPORT,
};

/** route param이 샘플 리포트 ID인지 판별 */
export const isSampleReportId = (id?: string): boolean => !!id && id in SAMPLE_REPORTS;

/** 샘플 리포트 조회 (없으면 주간 폴백) */
export const getSampleReport = (id?: string): AiReport =>
  (id ? SAMPLE_REPORTS[id] : undefined) ?? SAMPLE_WEEKLY_REPORT;
