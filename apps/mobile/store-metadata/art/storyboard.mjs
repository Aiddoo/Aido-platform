// 1.13.0 스토어 아트의 단일 원본: 출력 규격(targets), 장면(slots), 세트(sets), 배너(scenes).
// 캡처 파일은 maestro/screenshots-1.13.0/capture.sh 결과 폴더 규칙을 따른다:
//   <captures>/<기기>/<일반|프리미엄>/<라이트|다크>[/en]/<NN_화면명>.png
// 문구 규칙: 태그라인은 짧게(ko 14자 안팎), 헤드라인은 두 줄(\n), 해요체. 영어는 sentence case.
// [강조]는 주황 강조, 문구는 앱이 실제로 하는 일만 쓴다(store-metadata/listing/README.md).

export const RELEASE_VERSION = '1.13.0';

// 출처: App Store Connect Screenshot specifications, Google Play preview assets(9866151).
export const TARGETS = {
  'iphone-6.3': {
    store: 'app-store',
    label: 'iPhone Dynamic Island 중형(6.3″)',
    width: 1206,
    height: 2622,
    frame: 'iphone',
    device: 'iPhone 17 Pro',
    folder: 'iphone-6.3_1206x2622',
    badge: true,
  },
  'iphone-6.9': {
    store: 'app-store',
    label: 'iPhone Dynamic Island 대형(6.9″) — 같은 캡처를 키워 씀',
    width: 1320,
    height: 2868,
    frame: 'iphone',
    device: 'iPhone 17 Pro',
    folder: 'iphone-6.9_1320x2868',
    badge: true,
  },
  'iphone-duo': {
    store: 'app-store',
    label: 'iPhone Duo 안쪽 화면',
    width: 2007,
    height: 2853,
    frame: 'duo-open',
    device: 'iPhone Duo 펼침',
    foldedDevice: 'iPhone Duo 접힘',
    folder: 'iphone-duo_2007x2853',
    badge: true,
  },
  'iphone-duo-outer': {
    store: 'app-store',
    label: 'iPhone Duo 바깥 화면(접힘)',
    width: 1398,
    height: 2034,
    frame: 'duo-closed',
    device: 'iPhone Duo 접힘',
    folder: 'iphone-duo-outer_1398x2034',
    badge: true,
  },
  'ipad-13': {
    store: 'app-store',
    label: 'iPad 13″',
    width: 2064,
    height: 2752,
    frame: 'ipad',
    device: 'iPad Pro 13',
    folder: 'ipad-13_2064x2752',
    badge: true,
  },
  'play-phone': {
    store: 'google-play',
    label: 'Google Play 휴대전화(9:16)',
    width: 1080,
    height: 1920,
    // Play 가이드: 기기 이미지는 금방 낡아 보이니 화면만 카드로 보여준다.
    frame: 'card',
    device: 'Android 폰',
    folder: 'phone_1080x1920',
    // Play 그래픽에는 "New" 같은 기간 한정 표현을 쓰지 않는다.
    badge: false,
  },
  // Play 태블릿(7″·10″): 16:9 가로, 1,080~7,680px. 가이드가 앱 화면 밖 글자를 빼라고 해서 문구 없이 화면만 둔다.
  'play-tablet-7': {
    store: 'google-play',
    label: 'Google Play 7″ 태블릿(16:9, 문구 없음)',
    width: 1920,
    height: 1080,
    frame: 'card-fold',
    device: 'Android 폴드 펼침',
    folder: 'tablet-7_1920x1080',
    badge: false,
    bare: true,
  },
  'play-tablet-10': {
    store: 'google-play',
    label: 'Google Play 10″ 태블릿(16:9, 문구 없음)',
    width: 2560,
    height: 1440,
    frame: 'card-fold',
    device: 'Android 폴드 펼침',
    folder: 'tablet-10_2560x1440',
    badge: false,
    bare: true,
  },
};

const premium = (file, extra = {}) => ({ file, plan: '프리미엄', theme: '라이트', ...extra });

// 장면. capture는 기기 폴더 아래 경로, foldedCapture는 Duo 접힘 화면(쌍 배치)이다.
export const SLOTS = {
  ai: {
    title: 'AI 할 일',
    capture: premium('16_AI_음성_입력_안내'),
    ko: { tagline: '말하면 뚝딱, 투두는 바로', headline: 'AI로 말하면\n할 일이 바로 생성돼요' },
    en: { tagline: 'Just say it', headline: 'Speak or type,\nand AI makes the to-do' },
  },
  invite: {
    title: '친구 초대(1.13.0)',
    capture: premium('50_내_초대'),
    isNew: true,
    decor: 'cat-peek',
    ko: {
      tagline: '서로 콕콕, 함께 받는 보상',
      headline: '친구를 초대하면\n친구도 나도 [프리미엄 7일]',
      note: '받는 조건은 앱의 친구 초대 화면에서 확인할 수 있어요',
    },
    en: {
      tagline: 'Better together',
      headline: 'Invite a friend and\nyou both get [7 days of Premium]',
      note: 'Conditions apply. See Invite friends in the app.',
    },
  },
  friends: {
    title: '친구 피드·콕',
    capture: premium('10_홈_오늘'),
    ko: { tagline: '미루면 콕, 함께하면 쭉', headline: '친구와 서로 챙기며\n끝까지 해내요' },
    en: { tagline: 'Nudge, cheer, repeat', headline: 'Keep each other going\nall the way to done' },
  },
  subtasks: {
    title: '세부 항목',
    capture: premium('14_할일_체크리스트'),
    ko: { tagline: '쪼개면 쪼갤수록', headline: '세부 항목을 추가해서\n더 꼼꼼하게 관리해요' },
    en: { tagline: 'Break it down', headline: 'Add subtasks and\nstay on top of details' },
  },
  options: {
    title: '할 일 옵션 한 화면',
    capture: premium('17_반복_할일_편집'),
    ko: { tagline: '날짜부터 반복까지 한 번에', headline: '날짜·시간·반복을\n한 화면에서 정해요' },
    en: { tagline: 'All in one sheet', headline: 'Set the date, time,\nand repeat in one place' },
  },
  suggestions: {
    title: 'AI 반복 제안',
    capture: premium('34_AI_반복_제안'),
    ko: { tagline: '자주 하는 일, AI가 먼저', headline: '반복되는 할 일을\nAI가 알아서 추천해요' },
    en: { tagline: 'AI spots your routines', headline: 'AI suggests the to-dos\nyou repeat often' },
  },
  report: {
    title: 'AI 리포트',
    capture: premium('31_AI_리포트_주간'),
    ko: {
      tagline: '주간·월간 리포트로 한눈에',
      headline: '내 할 일 패턴을 분석해\n리포트로 보여줘요',
    },
    en: { tagline: 'Weekly and monthly reports', headline: 'See your patterns\nin AI reports' },
  },
  reminders: {
    title: '리마인더',
    capture: premium('76_알림_설정'),
    ko: { tagline: '알림은 딱, 내 시간에 맞게', headline: '원하는 시간대로\n리마인드를 설정해요' },
    en: { tagline: 'Reminders on your time', headline: 'Get reminded\nwhen it suits you' },
  },
  widgets: {
    title: '홈 화면 위젯',
    // OS 홈 화면이라 maestro가 찍지 않는다. 같은 폴더에 직접 찍어 둔다(README '직접 찍는 화면').
    // 휴대전화는 작은(2×2)+중간(4×2), 큰 화면은 중간+큰(4×4) 위젯을 할 일이 있는 오늘로 배치한다.
    capture: premium('W1_홈_화면_위젯', { manual: true }),
    ko: { tagline: '앱을 열지 않아도', headline: '오늘 할 일을\n홈 화면 위젯으로 봐요' },
    en: { tagline: 'Right on your Home Screen', headline: 'See today’s to-dos\nin a widget' },
  },
  memo: {
    title: '메모 → AI 할 일',
    capture: premium('23_메모_AI_분석_결과'),
    ko: { tagline: '메모 한 장이 할 일로', headline: '메모를 쓰면\nAI가 할 일로 정리해요' },
    en: { tagline: 'From notes to to-dos', headline: 'Write a note and\nAI turns it into to-dos' },
  },
  // ---- iPhone Duo / 큰 화면 ----
  'duo-hero': {
    title: 'Duo 접힘·펼침',
    capture: premium('13_할일_상세_콕'),
    foldedCapture: premium('10_홈_오늘'),
    layout: 'duo-pair',
    ko: { tagline: '접어도 펼쳐도 그대로', headline: '펼치면 목록과 상세를\n나란히 봐요' },
    en: {
      tagline: 'Fold or unfold',
      headline: 'Unfold to see your list\nand details side by side',
    },
  },
  'large-feed': {
    title: '피드 2단',
    capture: premium('13_할일_상세_콕'),
    ko: { tagline: '넓은 화면엔 두 칸으로', headline: '목록과 상세를\n한 화면에서 봐요' },
    en: {
      tagline: 'Two panes on wide screens',
      headline: 'See your list and details\non one screen',
    },
  },
  'large-memo': {
    title: '메모 2단',
    capture: premium('21_메모_상세'),
    ko: { tagline: '메모도 나란히', headline: '메모 목록과 내용을\n같이 봐요' },
    en: { tagline: 'Notes side by side', headline: 'Browse notes and\nread them at once' },
  },
  'large-widgets': {
    title: '위젯(자정 갱신)',
    // 기본 세트는 라이트 위젯이라 큰 화면 CPP에서는 다크 모드 위젯을 보여준다(iOS timeline이라 자정 정각에 바뀐다).
    capture: premium('W1_홈_화면_위젯', { manual: true, theme: '다크' }),
    ko: { tagline: '자정이면 위젯도 새날', headline: '자정이 지나면\n위젯이 바로 바뀌어요' },
    en: {
      tagline: 'Widgets update at midnight',
      headline: 'Your widget switches\nto the new day at midnight',
    },
  },
  'large-settings': {
    title: '설정 2단',
    capture: premium('76_알림_설정'),
    ko: { tagline: '설정도 한눈에', headline: '알림과 설정을\n한눈에 정리해요' },
    en: { tagline: 'Settings at a glance', headline: 'Manage reminders\nand settings at a glance' },
  },
  // ---- 맞춤형 제품 페이지·맞춤 등록정보(초대 유입) ----
  'invite-card': {
    title: '받은 초대 카드',
    capture: premium('85_초대카드_로그인'),
    isNew: true,
    decor: 'cat-peek',
    ko: { tagline: '초대 링크를 받았다면', headline: '친구가 아이두에\n[초대했어요]' },
    en: { tagline: 'Got an invite link?', headline: 'Your friend invited you\nto [Aido]' },
  },
  'invite-accept': {
    title: '초대 수락',
    capture: premium('86_초대_환영_시트'),
    ko: { tagline: '가입 7일 안이라면', headline: '초대를 수락하면\n[프리미엄 7일]' },
    en: {
      tagline: 'If you joined within 7 days',
      headline: 'Accept the invite and\nget [7 days of Premium]',
    },
  },
  'paw-board': {
    title: '발자국 모으기',
    capture: premium('51_발자국_판'),
    ko: {
      tagline: '친구가 다른 날 두 번 해내면',
      headline: '발자국이 찍히고\n나도 [프리미엄 7일]',
    },
    en: {
      tagline: 'When your friend shows up',
      headline: 'Collect paw prints and\nget [7 days of Premium]',
    },
  },
  'friends-feed': {
    title: '친구 피드',
    capture: premium('42_친구_피드'),
    ko: { tagline: '미루면 콕, 함께하면 쭉', headline: '서로의 할 일을 보고\n콕 찔러 응원해요' },
    en: { tagline: 'Nudge, cheer, repeat', headline: 'See each other’s to-dos\nand send a nudge' },
  },
  'ai-short': {
    title: 'AI 입력(짧게)',
    capture: premium('16_AI_음성_입력_안내'),
    ko: { tagline: '말하면 뚝딱, 투두는 바로', headline: '말하면\n할 일이 돼요' },
    en: { tagline: 'Just say it', headline: 'Say it, and\nit’s a to-do' },
  },
  'ai-date': {
    title: 'AI 날짜 계산',
    capture: premium('15_할일_추가_시트'),
    ko: { tagline: '‘다음 주 금요일’도', headline: '말하면 날짜까지\n정확하게 맞춰요' },
    en: { tagline: '“Next Friday” works too', headline: 'AI gets the date\nright every time' },
  },
  'ai-time': {
    title: 'AI 시간 맞춤',
    // AI 음성 결과 화면은 시뮬레이터에서 자동으로 못 찍어, AI가 만든 할 일이 보이는 홈으로 대신한다.
    capture: premium('10_홈_오늘'),
    ko: { tagline: '‘저녁’은 오후 7시로', headline: '때만 말해도\n시간을 알아서 정해요' },
    en: { tagline: '“Evening” means 7 PM', headline: 'Say the time of day,\nAI sets the time' },
  },
  'ai-memo': {
    title: 'AI 메모 → 할 일',
    capture: premium('23_메모_AI_분석_결과'),
    ko: { tagline: '메모 한 장이 할 일로', headline: '메모 한 장이\n할 일 여러 개로' },
    en: { tagline: 'From notes to to-dos', headline: 'One note,\nmany to-dos' },
  },
  'ai-suggestions': {
    title: 'AI 반복 제안(짧게)',
    capture: premium('34_AI_반복_제안'),
    ko: { tagline: '자주 하는 일, AI가 먼저', headline: '자주 하는 일은\n반복으로 제안해요' },
    en: { tagline: 'AI spots your routines', headline: 'Repeat what\nyou often do' },
  },
  'ai-report': {
    title: 'AI 리포트(짧게)',
    capture: premium('31_AI_리포트_주간'),
    ko: { tagline: '내 시간대의 월요일에', headline: '월요일엔\n지난주 리포트' },
    en: { tagline: 'On Monday in your time zone', headline: 'Your week in review,\nevery Monday' },
  },
};

// 위젯은 앱을 열지 않고 매일 보는 기능이라, 핵심 흐름(AI 입력 → 초대 → 친구) 바로 다음 4번째에 둔다.
const MAIN_IPHONE = [
  'ai',
  'invite',
  'friends',
  'widgets',
  'subtasks',
  'options',
  'suggestions',
  'report',
  'reminders',
  'memo',
];
const MAIN_PLAY = [
  'ai',
  'invite',
  'friends',
  'widgets',
  'subtasks',
  'suggestions',
  'report',
  'reminders',
];
const CPP_INVITE = ['invite-card', 'invite-accept', 'paw-board', 'friends-feed', 'ai-short'];

// 세트: 어디에 올리는 이미지 묶음인지. locales는 ko/en, folder는 업로드 폴더 안 위치.
export const SETS = [
  {
    id: 'main',
    label: '기본 제품 페이지',
    targets: ['iphone-6.3', 'iphone-6.9', 'iphone-duo-outer', 'ipad-13'],
    slots: MAIN_IPHONE,
  },
  {
    id: 'main',
    label: '기본 제품 페이지',
    targets: ['iphone-duo'],
    slots: [
      'duo-hero',
      'ai',
      'invite',
      'large-feed',
      'widgets',
      'large-memo',
      'report',
      'suggestions',
      'large-settings',
    ],
  },
  { id: 'main', label: '기본 스토어 등록정보', targets: ['play-phone'], slots: MAIN_PLAY },
  {
    id: 'main',
    label: '기본 스토어 등록정보(태블릿)',
    targets: ['play-tablet-7', 'play-tablet-10'],
    slots: ['large-feed', 'ai', 'invite', 'widgets', 'large-memo', 'report', 'large-settings'],
  },
  {
    id: 'cpp-invite',
    label: 'CPP-1 초대 유입',
    targets: ['iphone-6.3', 'iphone-6.9', 'ipad-13'],
    slots: CPP_INVITE,
  },
  {
    id: 'cpp-ai',
    label: 'CPP-2 AI',
    targets: ['iphone-6.3', 'iphone-6.9', 'ipad-13'],
    slots: ['ai-date', 'ai-time', 'ai-memo', 'ai-suggestions', 'ai-report'],
  },
  {
    id: 'cpp-large',
    label: 'CPP-3 큰 화면',
    targets: ['ipad-13', 'iphone-duo'],
    slots: ['large-feed', 'large-memo', 'large-widgets', 'large-settings'],
  },
  {
    id: 'ppo-invite-first',
    label: 'PPO 처리안: 초대 먼저',
    targets: ['iphone-6.3', 'iphone-6.9', 'ipad-13'],
    locales: ['ko'],
    slots: ['invite-card', 'paw-board', ...MAIN_IPHONE.slice(2)],
  },
  {
    id: 'custom-listing-invite',
    label: 'Play 맞춤 등록정보 invite',
    targets: ['play-phone'],
    slots: [...CPP_INVITE, 'ai-date'],
  },
  {
    id: 'custom-listing-invite',
    label: 'Play 맞춤 등록정보 invite(태블릿)',
    targets: ['play-tablet-7', 'play-tablet-10'],
    slots: ['invite', 'large-feed', 'ai', 'report'],
  },
  {
    id: 'experiment-invite-first',
    label: 'Play 등록정보 실험: 초대 먼저',
    targets: ['play-phone'],
    locales: ['ko'],
    slots: ['invite-card', 'paw-board', ...MAIN_PLAY.slice(2)],
  },
];

// 배너·이벤트·그래픽 이미지. 캡처가 필요 없어 바로 최종본을 만든다.
// design: CSS 픽셀 크기, scale: 출력 배율. text: false면 글자 없이(인앱 이벤트·Play 맞춤 그래픽).
export const SCENES = {
  header: {
    store: 'app-store',
    label: '제품 페이지 헤더(21:9)',
    design: [1920, 823],
    scale: 2,
    file: 'header_3840x1646.png',
    ko: { tagline: '혼자 하면 미루고, 같이 하면 끝내요', headline: '서로 [콕콕],\n오늘 할 일 끝!' },
    en: {
      tagline: 'Put it off alone, finish it together',
      headline: 'Nudge each other,\n[done] for today!',
    },
  },
  search: {
    store: 'app-store',
    label: '검색 결과(3:2)',
    design: [1920, 1280],
    scale: 2,
    file: 'search-result_3840x2560.png',
    ko: { tagline: '혼자 하면 미루고, 같이 하면 끝내요', headline: '서로 콕콕, 오늘 할 일 끝!' },
    en: {
      tagline: 'Put it off alone, finish it together',
      headline: 'Nudge each other, done today!',
    },
  },
  'feature-graphic': {
    store: 'google-play',
    label: '그래픽 이미지(1024×500)',
    design: [1024, 500],
    scale: 1,
    file: 'feature-graphic_1024x500.png',
    ko: { tagline: '할 일을 미루지 않고, 아이두', headline: '친구랑 같이 끝내는\nAI 투두' },
    en: { tagline: 'Stop putting it off', headline: 'AI to-dos you finish\nwith friends' },
  },
  'feature-graphic-invite': {
    store: 'google-play',
    label: '맞춤 등록정보 invite 그래픽(글자 없음)',
    design: [1024, 500],
    scale: 1,
    file: 'feature-graphic-invite_1024x500.png',
    text: false,
  },
  'event-card': {
    store: 'app-store',
    label: '인앱 이벤트 카드(16:9, 글자 없음)',
    design: [1920, 1080],
    scale: 2,
    file: 'event-card_3840x2160.png',
    text: false,
  },
  'event-detail': {
    store: 'app-store',
    label: '인앱 이벤트 상세(9:16, 글자 없음)',
    design: [1080, 1920],
    scale: 2,
    file: 'event-detail_2160x3840.png',
    text: false,
  },
  // Play 프로모션 콘텐츠(LiveOps)용 기본 이미지. 지금은 자격(Premium growth tools) 밖이라 보관만 한다.
  // 16:9 1920×1080, 글자·테두리 금지, 1MB 이하, 안전 영역 위 15%·옆 10%·아래 20%.
  'play-promo': {
    store: 'google-play',
    label: 'Play 프로모션 콘텐츠(16:9, 글자 없음, 보관용)',
    design: [1920, 1080],
    scale: 1,
    file: 'promotional-content_1920x1080.jpg',
    text: false,
    maxBytes: 1024 * 1024,
  },
};

// 배너 카드 안 앱 UI 문구(실제 앱 i18n과 같은 말).
export const CARD_COPY = {
  ko: {
    rows: ['아침 운동', '책 10쪽 읽기'],
    nudge: '콕',
    reward: '친구도 나도 프리미엄 7일',
    condition: '조건 있음 · 앱에서 확인',
    board: '발자국 모으기',
  },
  en: {
    rows: ['Morning workout', 'Read 10 pages'],
    nudge: 'Nudge',
    reward: '7 days of Premium for both of you',
    condition: 'Conditions apply',
    board: 'Collect paw prints',
  },
};

export const LOCALES = ['ko', 'en'];
