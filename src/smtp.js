const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 15000);

async function sendMail({ from, to, subject, text, replyTo }) {
  if (!SMTP_HOST) throw new Error('SMTP_HOST nie je nastavené');
  if (!SMTP_USER || !SMTP_PASS) throw new Error('SMTP_USER alebo SMTP_PASS nie je nastavené');
  if (!from || !to) throw new Error('From/To nie je nastavené');

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    replyTo,
  });

  return true;
}

module.exports = { sendMail };
