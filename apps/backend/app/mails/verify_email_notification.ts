import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

/**
 * The signup verification email (AUDIT.md G1).
 *
 * Written as inline HTML plus a plain-text alternative rather than an
 * Edge template, so the app does not take on `edge.js` for one message.
 * Both parts carry the link: plenty of clients render text only, and a
 * verification mail that only works in HTML strands those users.
 */

/** Escapes the five characters that can break out of HTML text/attributes. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default class VerifyEmailNotification extends BaseMail {
  /**
   * @param user - the account being verified, used for the greeting and
   *   the recipient address.
   * @param verificationUrl - the full frontend URL carrying the raw
   *   token. Built by #services/email_verification_service so the token
   *   never has to be handled here.
   * @param expiresInHours - stated in the copy so the user knows why a
   *   stale link stopped working.
   */
  constructor(
    private user: User,
    private verificationUrl: string,
    private expiresInHours: number
  ) {
    super()
  }

  /**
   * Builds the message. Called by the mailer immediately before send.
   */
  prepare(): void {
    const username = escapeHtml(this.user.username)
    // The URL is generated, not user input, but it lands in an href and
    // carries a base64url token, so it is escaped like any other value.
    const url = escapeHtml(this.verificationUrl)

    this.message
      .to(this.user.email)
      .subject('Verify your email address for Kalooki Online')
      .html(
        `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Welcome to Kalooki Online, ${username}</h1>
      <p style="margin:0 0 16px;line-height:1.5;">
        Confirm this email address to finish setting up your account and start playing.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          Verify my email
        </a>
      </p>
      <p style="margin:0 0 16px;line-height:1.5;color:#52525b;font-size:14px;">
        The link expires in ${this.expiresInHours} hours and can only be used once.
        If the button does not work, paste this into your browser:
      </p>
      <p style="margin:0 0 24px;word-break:break-all;font-size:13px;color:#52525b;">${url}</p>
      <p style="margin:0;line-height:1.5;color:#52525b;font-size:13px;">
        If you did not create a Kalooki Online account, ignore this email and nothing will happen.
      </p>
    </div>
  </body>
</html>`
      )
      .text(
        `Welcome to Kalooki Online, ${this.user.username}\n\n` +
          `Confirm this email address to finish setting up your account:\n\n` +
          `${this.verificationUrl}\n\n` +
          `The link expires in ${this.expiresInHours} hours and can only be used once.\n\n` +
          `If you did not create a Kalooki Online account, ignore this email and nothing will happen.\n`
      )
  }
}
