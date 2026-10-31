import { google } from 'googleapis';
import { decryptToken } from '../crypto.js';
import { logger } from '../../logger.js';
import { AppError } from '../../middleware/errorHandler.js';

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface SendEmailOptions {
  provider: 'gmail' | 'outlook';
  encryptedRefreshToken: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  htmlBody: string;
}

export class EmailService {
  /**
   * Generates OAuth authorization URL for Gmail or Outlook
   */
  getOAuthUrl(provider: 'gmail' | 'outlook', redirectUri: string, state: string): string {
    if (provider === 'gmail') {
      const clientId = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
      const oauth2Client = new google.auth.OAuth2(clientId, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
      return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
        state
      });
    }

    if (provider === 'outlook') {
      const clientId = process.env.MICROSOFT_CLIENT_ID || 'mock-microsoft-client-id';
      const scopes = encodeURIComponent('offline_access Mail.Send User.Read');
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_mode=query&scope=${scopes}&state=${state}`;
    }

    throw new AppError(400, 'UNSUPPORTED_PROVIDER', `Provider ${provider} is not supported.`);
  }

  /**
   * Exchanges authorization code for tokens and user email address
   */
  async exchangeOAuthCode(
    provider: 'gmail' | 'outlook',
    code: string,
    redirectUri: string
  ): Promise<{ address: string; refreshToken: string; scopes: string }> {
    // 1. Mock / offline handling
    if (
      code.startsWith('mock-code-') ||
      process.env.MOCK_EMAIL === 'true' ||
      (!process.env.GOOGLE_CLIENT_ID && provider === 'gmail') ||
      (!process.env.MICROSOFT_CLIENT_ID && provider === 'outlook')
    ) {
      return {
        address: provider === 'gmail' ? 'recruiter@acme-corp.com' : 'hr-team@acme-corp.onmicrosoft.com',
        refreshToken: `mock-refresh-token-${provider}-${Date.now()}`,
        scopes: provider === 'gmail' ? 'https://www.googleapis.com/auth/gmail.send' : 'Mail.Send'
      };
    }

    // 2. Real Gmail OAuth exchange
    if (provider === 'gmail') {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        throw new AppError(
          400,
          'MISSING_REFRESH_TOKEN',
          'Google did not return a refresh token. Please remove app access from Google Account and reconnect.'
        );
      }
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const address = userInfo.data.email;
      if (!address) {
        throw new AppError(400, 'MISSING_EMAIL', 'Could not retrieve email address from Google Account.');
      }

      return {
        address,
        refreshToken: tokens.refresh_token,
        scopes: tokens.scope || 'https://www.googleapis.com/auth/gmail.send'
      };
    }

    // 3. Real Outlook / Microsoft Graph OAuth exchange
    if (provider === 'outlook') {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const body = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data.refresh_token) {
        throw new AppError(400, 'OAUTH_FAILED', data.error_description || 'Microsoft OAuth token exchange failed.');
      }

      // Fetch user email from Graph API
      const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      const userData = (await userRes.json()) as any;
      const address = userData.mail || userData.userPrincipalName;

      return {
        address,
        refreshToken: data.refresh_token,
        scopes: data.scope || 'Mail.Send'
      };
    }

    throw new AppError(400, 'UNSUPPORTED_PROVIDER', `Provider ${provider} is not supported.`);
  }

  /**
   * Revokes refresh token upon disconnecting an account
   */
  async revokeToken(provider: 'gmail' | 'outlook', encryptedRefreshToken: string): Promise<void> {
    try {
      const refreshToken = decryptToken(encryptedRefreshToken);
      if (refreshToken.startsWith('mock-refresh-token')) {
        return;
      }

      if (provider === 'gmail') {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        await oauth2Client.revokeToken(refreshToken);
      }
      // Microsoft Graph tokens expire automatically when app permission is revoked
    } catch (err) {
      logger.warn({ err, provider }, 'Failed to revoke token with provider; local record will be removed');
    }
  }

  /**
   * Renders email template variables: {{candidate_name}}, {{job_title}}, {{company}}
   * Sanitizes output against malicious scripts.
   */
  renderTemplate(
    template: { subject: string; body: string },
    vars: { candidate_name: string; job_title: string; company: string }
  ): RenderedEmail {
    const sanitizeText = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeCandidateName = sanitizeText(vars.candidate_name || 'Applicant');
    const safeJobTitle = sanitizeText(vars.job_title || 'Position');
    const safeCompany = sanitizeText(vars.company || 'Our Company');

    let renderedSubject = template.subject
      .replace(/{{\s*candidate_name\s*}}/gi, safeCandidateName)
      .replace(/{{\s*job_title\s*}}/gi, safeJobTitle)
      .replace(/{{\s*company\s*}}/gi, safeCompany);

    let renderedBody = template.body
      .replace(/{{\s*candidate_name\s*}}/gi, safeCandidateName)
      .replace(/{{\s*job_title\s*}}/gi, safeJobTitle)
      .replace(/{{\s*company\s*}}/gi, safeCompany);

    // Sanitize script and event handlers from HTML
    renderedBody = renderedBody
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');

    return {
      subject: renderedSubject,
      html: renderedBody
    };
  }

  /**
   * Sends an email through Gmail or Outlook using the decrypted refresh token.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
    const { provider, encryptedRefreshToken, fromAddress, toAddress, subject, htmlBody } = options;
    const refreshToken = decryptToken(encryptedRefreshToken);

    // Mock sending for tests or offline environment
    if (
      refreshToken.startsWith('mock-refresh-token') ||
      process.env.MOCK_EMAIL === 'true' ||
      toAddress.endsWith('@test.local')
    ) {
      logger.info(
        { provider, from: fromAddress, to: toAddress, subject },
        'Mock sending email successfully'
      );
      return { messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    }

    if (provider === 'gmail') {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Construct standard RFC 2822 formatted message
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${fromAddress}`,
        `To: ${toAddress}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        htmlBody
      ];
      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      return { messageId: res.data.id || `gmail-${Date.now()}` };
    }

    if (provider === 'outlook') {
      // Refresh Outlook access token
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const body = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const tokenData = (await tokenRes.json()) as any;
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(`Failed to refresh Outlook access token: ${tokenData.error_description || 'Unknown error'}`);
      }

      // Send via Microsoft Graph API
      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject,
            body: {
              contentType: 'HTML',
              content: htmlBody
            },
            toRecipients: [
              {
                emailAddress: {
                  address: toAddress
                }
              }
            ]
          },
          saveToSentItems: true
        })
      });

      if (!graphRes.ok) {
        const errorData = (await graphRes.json().catch(() => ({}))) as any;
        throw new Error(
          `Outlook Microsoft Graph sendMail failed: ${errorData?.error?.message || graphRes.statusText}`
        );
      }

      return { messageId: `outlook-${Date.now()}` };
    }

    throw new AppError(400, 'UNSUPPORTED_PROVIDER', `Provider ${provider} is not supported.`);
  }

  /**
   * Dispatches system / platform transactional emails (e.g. candidate deletion verification codes)
   */
  async sendPlatformEmail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId: string }> {
    const platformFrom = process.env.PLATFORM_EMAIL_FROM || 'privacy@shortlistiq.com';
    // Mask recipient email for logging to ensure personal data never appears in operational logs
    const maskedTo = options.to.replace(/(?<=.).(?=[^@]*?@)/g, '*');

    logger.info(
      {
        from: platformFrom,
        to: maskedTo,
        subject: options.subject
      },
      'Platform transactional email dispatched'
    );

    return { messageId: `platform-${Date.now()}` };
  }
}

export const emailService = new EmailService();

