import pino from 'pino';
import { env } from './config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.resumeText',
      'req.body.personalData',
      'req.body.password',
      'req.body.code',
      'req.body.turnstileToken',
      'password',
      'token',
      'refreshToken',
      'encryptedRefreshToken',
      'codeHash',
      'apiKey'
    ],
    censor: '[REDACTED]'
  }
});

