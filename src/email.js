const { sendMail } = require('./smtp');

const COMPANY_NAME = process.env.COMPANY_NAME || 'MV-MONT';
const CONTACT_TO = process.env.CONTACT_TO || '';
const CONTACT_FROM = process.env.CONTACT_FROM || '';

function formatServiceLabel(service) {
  const map = {
    frameless: 'Bezrámové presklenia',
    framed: 'Rámové presklenia',
    shutters: 'Rolety',
    blinds: 'Žalúzie',
    terraces: 'Terasy',
    railings: 'Balkónové zábradlia',
    screens: 'Siete proti hmyzu',
  };
  return map[service] || service;
}

function buildCompanyEmail(entry) {
  return {
    to: CONTACT_TO,
    from: CONTACT_FROM || CONTACT_TO,
    subject: `Nový kontakt z webu (${COMPANY_NAME})`,
    text: [
      `Meno: ${entry.name}`,
      `E-mail: ${entry.email}`,
      `Telefón: ${entry.phone}`,
      `Typ služby: ${formatServiceLabel(entry.service)}`,
      '',
      'Správa:',
      entry.message,
      '',
      `Čas odoslania: ${entry.createdAt}`,
    ].join('\n'),
  };
}

function buildCustomerEmail(entry) {
  return {
    to: entry.email,
    from: CONTACT_FROM || CONTACT_TO,
    replyTo: CONTACT_TO || CONTACT_FROM,
    subject: `Potvrdenie prijatia správy (${COMPANY_NAME})`,
    text: [
      `Dobrý deň ${entry.name},`,
      '',
      'Ďakujeme za Vašu správu. Potvrdzujeme jej prijatie a čoskoro sa Vám ozveme.',
      '',
      'Zhrnutie:',
      `Typ služby: ${formatServiceLabel(entry.service)}`,
      `Telefón: ${entry.phone}`,
      '',
      'Vaša správa:',
      entry.message,
      '',
      `S pozdravom,`,
      COMPANY_NAME,
    ].join('\n'),
  };
}

async function sendContactEmails(entry) {
  if (!CONTACT_TO) {
    return { ok: false, error: new Error('CONTACT_TO nie je nastavené') };
  }

  if (!CONTACT_FROM) {
    return { ok: false, error: new Error('CONTACT_FROM nie je nastavené') };
  }

  const companyEmail = buildCompanyEmail(entry);
  const customerEmail = buildCustomerEmail(entry);

  try {
    await sendMail(companyEmail);
    await sendMail(customerEmail);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

module.exports = { sendContactEmails };
