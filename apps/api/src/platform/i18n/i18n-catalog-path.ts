import { resolve } from "node:path";

// 빌드는 nest-cli assets로 src/i18n을 dist/src/i18n에 복사해 소스·dist에서 같은 상대 경로가 된다
export const I18N_CATALOG_PATH = resolve(import.meta.dirname, "../../i18n");
