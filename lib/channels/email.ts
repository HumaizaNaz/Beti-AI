import nodemailer from 'nodemailer';

export interface EmailApi {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Gmail SMTP with an App Password — free, no own domain needed. */
export function createEmail(user: string, pass: string): EmailApi {
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from: `Beti AI <${user}>`, to, subject, text });
    },
  };
}
