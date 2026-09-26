import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../../config/env';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

/** Resend over plain fetch. Without an API key the email is logged, which is what local dev wants. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(email: OutboundEmail): Promise<void> {
    const env = loadEnv();
    if (!env.RESEND_API_KEY) {
      this.logger.log(
        `[email not configured] to=${email.to} subject="${email.subject}"\n${email.text}`,
      );
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Resend failed: ${res.status} ${await res.text()}`);
    }
  }
}
