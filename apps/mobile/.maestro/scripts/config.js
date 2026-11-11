// .env.maestro의 MAESTRO_* 값은 Maestro가 shell 환경에서 자동으로 읽는다(-e로 넘겨도 된다).
// 운영 앱·운영 API면 어떤 요청도 보내기 전에 멈춘다.
// docs: https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants

const PRODUCTION_APP_ID = 'com.aido.mobile';
// 시뮬레이터·에뮬레이터·같은 망의 실기기에서 닿는 개발 서버 주소만 받는다
const DEV_API_HOST =
  /^(localhost|127\.0\.0\.1|10\.0\.2\.2|host\.docker\.internal|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

const appId = typeof MAESTRO_APP_ID === 'undefined' ? '' : MAESTRO_APP_ID;
const appScheme = typeof MAESTRO_APP_SCHEME === 'undefined' ? 'aido-dev' : MAESTRO_APP_SCHEME;
const devClientScheme =
  typeof MAESTRO_DEV_CLIENT_SCHEME === 'undefined' ? 'exp+aido' : MAESTRO_DEV_CLIENT_SCHEME;
const metroUrl = typeof MAESTRO_METRO_URL === 'undefined' ? '' : MAESTRO_METRO_URL;
const apiUrl = (typeof MAESTRO_API_URL === 'undefined' ? 'http://localhost:8080' : MAESTRO_API_URL)
  .trim()
  .replace(/\/$/, '');

if (appId === '' || appId === PRODUCTION_APP_ID) {
  throw new Error(
    'MAESTRO_APP_ID는 개발 빌드(com.aido.mobile.dev 등)여야 합니다. 현재: "' + appId + '"',
  );
}

const apiHost = /^http:\/\/([^/:]+)(:\d+)?$/.exec(apiUrl);
if (apiHost == null || !DEV_API_HOST.test(apiHost[1])) {
  throw new Error('개발 서버(http, 로컬·사설망)에만 연결합니다. 현재 MAESTRO_API_URL: ' + apiUrl);
}

function account(email, password, name) {
  if (!email || !password) {
    return null;
  }
  return { email: email, password: password, name: name || email.split('@')[0] };
}

output.config = {
  appId: appId,
  appScheme: appScheme,
  apiUrl: apiUrl,
  // Metro 주소가 없으면(Release 로컬 빌드) 개발 클라이언트 연결을 건너뛴다
  // docs: https://docs.expo.dev/develop/development-builds/development-workflows/
  devClientLink:
    metroUrl === ''
      ? ''
      : devClientScheme +
        '://?__expo_url=' +
        encodeURIComponent(metroUrl) +
        '&__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1',
  // 흐름마다 새로 만들어 다시 돌려도 이름이 겹치지 않는다. Android inputText가 ASCII만 받아 영문·숫자로 둔다
  runId:
    (typeof MAESTRO_RUN_ID === 'undefined' ? '' : MAESTRO_RUN_ID) ||
    Date.now().toString(36).slice(-6),
  accounts: {
    main: account(
      typeof MAESTRO_MAIN_EMAIL === 'undefined' ? '' : MAESTRO_MAIN_EMAIL,
      typeof MAESTRO_MAIN_PASSWORD === 'undefined' ? '' : MAESTRO_MAIN_PASSWORD,
      typeof MAESTRO_MAIN_NAME === 'undefined' ? '' : MAESTRO_MAIN_NAME,
    ),
    second: account(
      typeof MAESTRO_SECOND_EMAIL === 'undefined' ? '' : MAESTRO_SECOND_EMAIL,
      typeof MAESTRO_SECOND_PASSWORD === 'undefined' ? '' : MAESTRO_SECOND_PASSWORD,
      typeof MAESTRO_SECOND_NAME === 'undefined' ? '' : MAESTRO_SECOND_NAME,
    ),
  },
};
