import { defineConfig } from "./define-config.js";
import { jwtSchema, validateJwtLifetimes } from "./schemas/jwt.schema.js";

export const jwtConfig = defineConfig(
  "jwt",
  jwtSchema.check(validateJwtLifetimes).transform((env) => ({
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  })),
  (env) => ({
    JWT_SECRET: env.JWT_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN,
  }),
);
