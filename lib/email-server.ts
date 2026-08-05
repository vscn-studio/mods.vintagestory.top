import nodemailer from 'nodemailer';

type MailTransport = ReturnType<typeof nodemailer.createTransport>;

let transport: MailTransport | null = null;

function smtpPort(): number {
  const raw = (process.env.SMTP_PORT ?? '587').trim();
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }
  return port;
}

function smtpSecure(port: number): boolean {
  const value = (process.env.SMTP_SECURE ?? '').trim().toLowerCase();
  if (!value) return port === 465;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function smtpFrom(): string {
  const from = (process.env.SMTP_FROM ?? '').trim();
  if (!from || /[\r\n]/.test(from)) throw new Error('SMTP_FROM must be configured without line breaks');
  return from;
}

function createTransport(): MailTransport {
  const host = (process.env.SMTP_HOST ?? '').trim();
  if (!host || /[\s\r\n]/.test(host)) throw new Error('SMTP_HOST must be configured');
  const port = smtpPort();
  const user = (process.env.SMTP_USER ?? '').trim();
  const password = process.env.SMTP_PASSWORD ?? '';
  if ((user && !password) || (!user && password)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: smtpSecure(port),
    requireTLS: process.env.NODE_ENV === 'production' && !smtpSecure(port),
    auth: user ? { user, pass: password } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
}

function mailTransport(): MailTransport {
  if (!transport) transport = createTransport();
  return transport;
}

export async function sendActivationEmail(recipient: string, code: string): Promise<void> {
  const from = smtpFrom();
  const webUrl = (process.env.WEB_URL ?? '').trim();
  await mailTransport().sendMail({
    from,
    to: recipient,
    subject: 'VSCN Mod DB 绑定验证码',
    text: `你的 VSCN Mod DB 绑定验证码是：${code}\n\n验证码 10 分钟内有效。如果不是你发起的操作，请忽略此邮件。${webUrl ? `\n\n网站：${webUrl}` : ''}`
  });
}
