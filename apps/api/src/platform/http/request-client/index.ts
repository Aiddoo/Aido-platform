export {
  normalizeDeviceName,
  normalizeDevicePlatform,
  parseAcceptLanguage,
  parseRequestClient,
  resolveResponseLocale,
  type RequestClient,
  type RequestClientPlatform,
} from "./request-client.js";
export { AppVersion, CurrentRequestClient } from "./request-client.decorator.js";
export { RequestClientModule } from "./request-client.module.js";
export {
  readRequestClient,
  REQUEST_CLIENT_CLS_MIDDLEWARE,
  RequestClientReader,
} from "./request-client.store.js";
export { assignRequestId, REQUEST_ID_HEADER } from "./request-id.js";
export { requestTimezoneIfSent, requestTimezoneOrUtc } from "./request-timezone.js";
