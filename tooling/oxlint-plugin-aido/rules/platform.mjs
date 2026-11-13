import { getImportedName, getKeyName, getMemberNames } from '../ast.mjs';

const SYSTEM_BAR_MESSAGE =
  'Android 15(API 35)부터 상태·내비게이션 바 색 API는 deprecated이고 edge-to-edge 앱에서 효과가 없으며 Play Console 경고가 됩니다. 바 뒤는 화면 배경과 safe area inset으로 그립니다(apps/mobile/docs/build-and-release.md "Play Console: Android 15 edge-to-edge deprecated API 경고").';

const STATUS_BAR_COLOR_PROPS = new Set(['backgroundColor', 'translucent']);
const STATUS_BAR_COLOR_METHODS = new Set(['setBackgroundColor', 'setTranslucent']);
// react-native-screens·expo-router 화면 옵션
const SCREEN_BAR_COLOR_OPTIONS = new Set([
  'statusBarColor',
  'statusBarBackgroundColor',
  'statusBarTranslucent',
  'navigationBarColor',
  'navigationBarTranslucent',
]);
const BAR_COLOR_FUNCTIONS_BY_MODULE = new Map([
  ['expo-navigation-bar', new Set(['setBackgroundColorAsync', 'setBorderColorAsync'])],
  ['expo-status-bar', new Set(['setStatusBarBackgroundColor', 'setStatusBarTranslucent'])],
]);
// app.config의 androidStatusBar·androidNavigationBar
const APP_CONFIG_BAR_KEYS = new Set(['androidStatusBar', 'androidNavigationBar']);
const APP_CONFIG_BAR_COLOR_KEYS = new Set(['backgroundColor', 'translucent']);

function isStatusBarElement(name) {
  if (name.type === 'JSXIdentifier') {
    return name.name === 'StatusBar';
  }
  return name.type === 'JSXMemberExpression' && name.property.name === 'StatusBar';
}

function isAppConfigBarColor(property) {
  const object = property.parent;
  const owner = object.parent;
  return (
    APP_CONFIG_BAR_COLOR_KEYS.has(getKeyName(property)) &&
    owner?.type === 'Property' &&
    owner.value === object &&
    APP_CONFIG_BAR_KEYS.has(getKeyName(owner))
  );
}

// 앱 코드는 시스템 바 색·반투명을 바꾸지 않는다. RN이 edge-to-edge로 바를 투명하게 두고 화면이 inset을 그린다
const noSystemBarColor = {
  meta: { type: 'problem' },
  create(context) {
    const barModuleNamespaces = new Map();

    function report(node, what) {
      context.report({ node, message: `${what}: ${SYSTEM_BAR_MESSAGE}` });
    }

    return {
      ImportDeclaration(node) {
        const functions = BAR_COLOR_FUNCTIONS_BY_MODULE.get(node.source.value);
        if (functions == null) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            barModuleNamespaces.set(specifier.local.name, functions);
          } else if (
            specifier.type === 'ImportSpecifier' &&
            functions.has(getImportedName(specifier))
          ) {
            report(specifier, `${node.source.value}의 ${getImportedName(specifier)}`);
          }
        }
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }
        const { name } = node.name;
        if (SCREEN_BAR_COLOR_OPTIONS.has(name)) {
          report(node, name);
        } else if (STATUS_BAR_COLOR_PROPS.has(name) && isStatusBarElement(node.parent.name)) {
          report(node, `StatusBar ${name}`);
        }
      },
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        if (names == null) {
          return;
        }
        const [object, method] = names;
        if (object === 'StatusBar' && STATUS_BAR_COLOR_METHODS.has(method)) {
          report(node, `StatusBar.${method}`);
        } else if (barModuleNamespaces.get(object)?.has(method) === true) {
          report(node, `${object}.${method}`);
        }
      },
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') {
          return;
        }
        const name = getKeyName(node);
        if (SCREEN_BAR_COLOR_OPTIONS.has(name)) {
          report(node, name);
        } else if (isAppConfigBarColor(node)) {
          report(node, `${getKeyName(node.parent.parent)}.${name}`);
        }
      },
    };
  },
};

export default {
  'no-system-bar-color': noSystemBarColor,
};
