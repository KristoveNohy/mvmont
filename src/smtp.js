const net = require('net');
const tls = require('tls');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 15000);

function encodeBase64(value) {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function normalizeLineEndings(value) {
  return value.replace(/\r?\n/g, '\r\n');
}

function buildMessage({ from, to, subject, text, replyTo }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ];

  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  return `${headers.join('\r\n')}\r\n\r\n${normalizeLineEndings(text || '')}`;
}

class SMTPClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
  }

  write(command) {
    this.socket.write(`${command}\r\n`);
  }

  async readResponse() {
    return new Promise((resolve, reject) => {
      const onData = (chunk) => {
        this.buffer += chunk.toString();
        if (!this.buffer.includes('\r\n')) return;

        const lines = this.buffer.split('\r\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (!lastLine) return;

        const code = lastLine.slice(0, 3);
        const isMultiLine = lines.some((line) => line.startsWith(`${code}-`));

        if (isMultiLine && !lastLine.startsWith(`${code} `)) {
          return;
        }

        this.socket.off('data', onData);
        resolve(lines.join('\n'));
      };

      const onError = (error) => {
        this.socket.off('data', onData);
        reject(error);
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }
}

async function openConnection() {
  if (!SMTP_HOST) {
    throw new Error('SMTP_HOST nie je nastavené');
  }

  const socket = SMTP_SECURE
    ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT })
    : net.connect({ host: SMTP_HOST, port: SMTP_PORT });

  socket.setTimeout(SMTP_TIMEOUT_MS, () => {
    socket.destroy(new Error('SMTP timeout'));
  });

  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function sendMail({ from, to, subject, text, replyTo }) {
  if (!SMTP_HOST) throw new Error('SMTP_HOST nie je nastavené');
  if (!SMTP_USER || !SMTP_PASS) throw new Error('SMTP_USER alebo SMTP_PASS nie je nastavené');
  if (!from || !to) throw new Error('From/To nie je nastavené');

  const socket = await openConnection();
  let activeSocket = socket;
  const client = new SMTPClient(socket);

  try {
    await client.readResponse();
    client.write(`EHLO ${SMTP_HOST}`);
    await client.readResponse();

    if (!SMTP_SECURE && SMTP_PORT === 587) {
      client.write('STARTTLS');
      const response = await client.readResponse();
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS zlyhalo: ${response}`);
      }

      const secureSocket = tls.connect({ socket, host: SMTP_HOST });
      await new Promise((resolve, reject) => {
        secureSocket.once('secureConnect', resolve);
        secureSocket.once('error', reject);
      });
      activeSocket = secureSocket;

      const secureClient = new SMTPClient(secureSocket);
      await secureClient.readResponse().catch(() => {});
      secureClient.write(`EHLO ${SMTP_HOST}`);
      await secureClient.readResponse();
      return await sendWithClient(secureClient, { from, to, subject, text, replyTo });
    }

    return await sendWithClient(client, { from, to, subject, text, replyTo });
  } finally {
    if (activeSocket && !activeSocket.destroyed) {
      activeSocket.end();
    }
  }
}

async function sendWithClient(client, { from, to, subject, text, replyTo }) {
  client.write('AUTH LOGIN');
  await client.readResponse();
  client.write(encodeBase64(SMTP_USER));
  await client.readResponse();
  client.write(encodeBase64(SMTP_PASS));
  await client.readResponse();

  client.write(`MAIL FROM:<${from}>`);
  await client.readResponse();
  client.write(`RCPT TO:<${to}>`);
  await client.readResponse();
  client.write('DATA');
  await client.readResponse();

  const message = buildMessage({ from, to, subject, text, replyTo });
  client.write(`${message}\r\n.`);
  await client.readResponse();
  client.write('QUIT');
  await client.readResponse();
  return true;
}

module.exports = { sendMail };
