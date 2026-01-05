const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config();
const { sendContactEmails } = require('./src/email');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin-token';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const Database = require('./src/database');
const CONTACTS_COLLECTION = 'contacts';
const GALLERY_COLLECTION = 'gallery';

const db = new Database(DATA_DIR);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

async function ensureStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await db.ensureCollection(CONTACTS_COLLECTION, []);
  await db.ensureCollection(GALLERY_COLLECTION, []);
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { message, ...(details ? { details } : {}) });
}

async function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function requireAdmin(req) {
  const token = req.headers['x-admin-token'];
  return token && token === ADMIN_TOKEN;
}

function buildUploadsUrl(filename) {
  return `/uploads/${filename}`;
}

async function persistBase64Image(imageData, imageName = '') {
  const dataUrlMatch = /^data:(.+);base64,(.*)$/i.exec(imageData || '');
  const base64Content = dataUrlMatch ? dataUrlMatch[2] : imageData;
  const mimeFromDataUrl = dataUrlMatch ? dataUrlMatch[1] : '';
  const extension = getExtension(imageName, mimeFromDataUrl);
  if (!extension) {
    throw new Error('Nepodporovaný formát obrázka');
  }

  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const buffer = Buffer.from(base64Content, 'base64');
  await fsp.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return buildUploadsUrl(filename);
}

function getExtension(imageName = '', mime = '') {
  const normalizedName = imageName.toLowerCase();
  if (normalizedName.endsWith('.png') || mime === 'image/png') return '.png';
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg') || mime === 'image/jpeg') return '.jpg';
  if (normalizedName.endsWith('.webp') || mime === 'image/webp') return '.webp';
  if (normalizedName.endsWith('.gif') || mime === 'image/gif') return '.gif';
  return '';
}

async function handleContactSubmission(req, res) {
  try {
    const rawBody = await getRequestBody(req);
    const payload = JSON.parse(rawBody || '{}');

    const errors = {};
    if (!payload.name || payload.name.trim() === '') errors.name = 'Prosím, zadajte vaše meno';
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.email = 'Prosím, zadajte platný e-mail';
    }
    if (!payload.phone || payload.phone.trim() === '') errors.phone = 'Prosím, zadajte telefónne číslo';
    if (!payload.service || payload.service.trim() === '') errors.service = 'Prosím, vyberte typ služby';
    if (!payload.message || payload.message.trim() === '') errors.message = 'Prosím, zadajte vašu správu';

    if (Object.keys(errors).length > 0) {
      sendError(res, 400, 'Formulár obsahuje chyby', errors);
      return;
    }

    const contacts = await db.read(CONTACTS_COLLECTION, []);
    const entry = {
      id: randomUUID(),
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      service: payload.service.trim(),
      message: payload.message.trim(),
      createdAt: new Date().toISOString(),
    };
    contacts.unshift(entry);
    await db.write(CONTACTS_COLLECTION, contacts);

    const emailResult = await sendContactEmails(entry);
    if (!emailResult.ok) {
      console.warn('Email sending failed:', emailResult.error);
    }

    sendJson(res, 201, {
      message: 'Ďakujeme za vašu správu! Ozveme sa vám čo najskôr.',
      contact: entry,
      emailStatus: emailResult.ok ? 'sent' : 'failed',
    });
  } catch (error) {
    console.error('Contact submission failed:', error);
    sendError(res, 500, 'Nastala chyba pri odosielaní formulára');
  }
}

async function handleGalleryList(res) {
  const items = await db.read(GALLERY_COLLECTION, []);
  sendJson(res, 200, { items });
}

async function handleGalleryCreate(req, res) {
  if (!requireAdmin(req)) {
    sendError(res, 401, 'Nesprávny administrátorský token');
    return;
  }

  try {
    const rawBody = await getRequestBody(req);
    const payload = JSON.parse(rawBody || '{}');
    const errors = {};

    if (!payload.title || payload.title.trim() === '') errors.title = 'Prosím, zadajte názov';
    if (!payload.category || payload.category.trim() === '') errors.category = 'Prosím, zadajte kategóriu';
    const hasUpload = payload.imageData || payload.imageUrl;
    if (!hasUpload) errors.image = 'Obrázok je povinný';

    if (Object.keys(errors).length > 0) {
      sendError(res, 400, 'Formulár obsahuje chyby', errors);
      return;
    }

    const gallery = await db.read(GALLERY_COLLECTION, []);
    let imageUrl = (payload.imageUrl || '').trim();
    if (payload.imageData) {
      imageUrl = await persistBase64Image(payload.imageData, payload.imageName || payload.title || 'image');
    }

    const entry = {
      id: randomUUID(),
      title: payload.title.trim(),
      description: payload.description ? payload.description.trim() : '',
      category: payload.category.trim(),
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    gallery.push(entry);
    await db.write(GALLERY_COLLECTION, gallery);
    sendJson(res, 201, { item: entry });
  } catch (error) {
    console.error('Gallery create failed:', error);
    sendError(res, 500, 'Nastala chyba pri ukladaní obrázka');
  }
}

async function handleGalleryUpdate(req, res, id) {
  if (!requireAdmin(req)) {
    sendError(res, 401, 'Nesprávny administrátorský token');
    return;
  }

  try {
    const rawBody = await getRequestBody(req);
    const payload = JSON.parse(rawBody || '{}');
    const gallery = await db.read(GALLERY_COLLECTION, []);
    const index = gallery.findIndex((item) => item.id === id);

    if (index === -1) {
      sendError(res, 404, 'Položka nebola nájdená');
      return;
    }

    const current = gallery[index];
    let imageUrl = current.imageUrl;

    if (payload.imageData) {
      if (current.imageUrl && current.imageUrl.startsWith('/uploads/')) {
        await removeLocalImage(current.imageUrl);
      }
      imageUrl = await persistBase64Image(payload.imageData, payload.imageName || current.title);
    } else if (payload.imageUrl) {
      if (current.imageUrl && current.imageUrl.startsWith('/uploads/')) {
        await removeLocalImage(current.imageUrl);
      }
      imageUrl = payload.imageUrl.trim();
    }

    const updated = {
      ...current,
      title: payload.title ? payload.title.trim() : current.title,
      description: payload.description ? payload.description.trim() : current.description,
      category: payload.category ? payload.category.trim() : current.category,
      imageUrl,
      updatedAt: new Date().toISOString(),
    };

    gallery[index] = updated;
    await db.write(GALLERY_COLLECTION, gallery);
    sendJson(res, 200, { item: updated });
  } catch (error) {
    console.error('Gallery update failed:', error);
    sendError(res, 500, 'Nastala chyba pri aktualizácii položky');
  }
}

async function handleGalleryDelete(req, res, id) {
  if (!requireAdmin(req)) {
    sendError(res, 401, 'Nesprávny administrátorský token');
    return;
  }

  try {
    const gallery = await db.read(GALLERY_COLLECTION, []);
    const index = gallery.findIndex((item) => item.id === id);
    if (index === -1) {
      sendError(res, 404, 'Položka nebola nájdená');
      return;
    }

    const [removed] = gallery.splice(index, 1);
    if (removed.imageUrl && removed.imageUrl.startsWith('/uploads/')) {
      await removeLocalImage(removed.imageUrl);
    }

    await db.write(GALLERY_COLLECTION, gallery);
    sendJson(res, 200, { message: 'Položka bola odstránená' });
  } catch (error) {
    console.error('Gallery delete failed:', error);
    sendError(res, 500, 'Nastala chyba pri odstraňovaní položky');
  }
}

async function removeLocalImage(imageUrl) {
  const relativePath = imageUrl.replace('/uploads/', '');
  const filePath = path.join(UPLOADS_DIR, relativePath);
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to delete image:', error);
    }
  }
}

async function serveStaticFile(res, pathname) {
  const safePath = path.normalize(path.join(__dirname, pathname === '/' ? '/index.html' : pathname));
  if (!safePath.startsWith(__dirname)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fsp.stat(safePath);
    if (stat.isDirectory()) {
      await serveStaticFile(res, path.join(pathname, 'index.html'));
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    });
    fs.createReadStream(safePath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendError(res, 404, 'Súbor nebol nájdený');
    } else {
      console.error('Static file error:', error);
      sendError(res, 500, 'Serverová chyba');
    }
  }
}

function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, {});
    return;
  }

  if (pathname === '/api/contact' && req.method === 'POST') {
    handleContactSubmission(req, res);
    return;
  }

  if (pathname === '/api/gallery' && req.method === 'GET') {
    handleGalleryList(res);
    return;
  }

  if (pathname === '/api/gallery' && req.method === 'POST') {
    handleGalleryCreate(req, res);
    return;
  }

  if (pathname.startsWith('/api/gallery/') && req.method === 'PUT') {
    const id = pathname.replace('/api/gallery/', '');
    handleGalleryUpdate(req, res, id);
    return;
  }

  if (pathname.startsWith('/api/gallery/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/gallery/', '');
    handleGalleryDelete(req, res, id);
    return;
  }

  serveStaticFile(res, pathname);
}

async function start() {
  await ensureStorage();
  const server = http.createServer(routeRequest);
  server.listen(PORT, () => {
    console.log(`Server beží na http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Server sa nepodarilo spustiť:', error);
});
