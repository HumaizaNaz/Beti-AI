import nodemailer from 'nodemailer';

export interface EmailApi {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Gmail SMTP with an App Password — free, no own domain needed. */
export function createEmail(user: string, pass: string): EmailApi {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    // Short timeouts: a stuck SMTP connection must not delay other alerts.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from: `Beti AI <${user}>`, to, subject, text });
    },
  };
}
