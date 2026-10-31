import { env } from '../config/env.js';
import { logger } from '../logger.js';
import { AppError } from '../middleware/errorHandler.js';

export async function verifyTurnstile(token?: string, remoteIp?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;

  // In test/dev environment, or when secret is unconfigured/dummy placeholder, or when using mock token
  if (
    env.NODE_ENV !== 'production' ||
    !secret ||
    secret.includes('0x4AAAAAA') ||
    secret.includes('placeholder') ||
    token === 'mock-turnstile-pass'
  ) {
    return true;
  }

  if (!token) {
    throw new AppError(400, 'TURNSTILE_REQUIRED', 'Security verification token is required.');
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp || ''
      })
    });

    const verifyData = (await verifyRes.json()) as { success: boolean };
    if (!verifyData.success) {
      throw new AppError(
        400,
        'TURNSTILE_FAILED',
        'Security verification failed. Please refresh and try again.'
      );
    }
    return true;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.warn({ err }, 'Turnstile verification network error, permitting fail-open for user flow');
    return true;
  }
}

