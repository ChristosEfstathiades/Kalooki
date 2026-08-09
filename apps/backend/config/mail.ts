import { defineConfig, transports } from '@adonisjs/mail'
import env from '#start/env'

/**
 * Outgoing mail. The only transactional message the app sends today is
 * the signup verification link (AUDIT.md G1), which is enforced in
 * production only.
 *
 * Resend is the configured provider. Only one mailer is defined on
 * purpose: a fallback transport that quietly accepts messages in
 * production is how "verification email never arrives" becomes a silent
 * failure again. When `RESEND_API_KEY` is absent,
 * `#services/email_verification_service` logs the link instead of
 * sending it and refuses to do so in production.
 */
const mailConfig = defineConfig({
  default: 'resend',

  /**
   * The envelope sender. Must be an address on a domain verified with
   * Resend (SPF + DKIM), or the provider rejects the message.
   */
  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'no-reply@localhost'),
    name: env.get('MAIL_FROM_NAME', 'Kalooki Online'),
  },

  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY', ''),
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
