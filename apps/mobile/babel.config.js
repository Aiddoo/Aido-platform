// jest는 Expo 설정(reactCompiler)을 읽지 않아, 앱과 같은 컴파일 결과로 테스트하려고 직접 켠다.
// 컴파일러가 렌더 중 getValues() 같은 비반응 읽기를 캐시하는 문제를 jest에서도 잡기 위해서다.
const reactCompilerPlugins = process.env.JEST_WORKER_ID
  ? [
      require.resolve('babel-plugin-react-compiler', {
        paths: [require.resolve('babel-preset-expo')],
      }),
    ]
  : [];

module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 경로 별칭(@src·@assets)은 Expo CLI가 tsconfig paths로 푼다. react-native-worklets/plugin은 babel-preset-expo(SDK 57+)가 자동 주입
    plugins: [],
    // 테스트 파일은 jest.mock 호이스팅이 깨지므로 제외한다
    overrides:
      reactCompilerPlugins.length === 0
        ? []
        : [{ test: /^(?!.*\.test\.tsx?$)/, plugins: reactCompilerPlugins }],
  };
};
