# MV-MONT statický web s backendom

Jednoduchý Node.js server, ktorý:

- podáva statické stránky firmy MV-MONT,
- prijíma správy z kontaktného formulára,
- spravuje galériu referencií (CRUD) chránenú admin tokenom,
- ukladá dáta do lokálnej JSON „databázy“ (`data/*.json`) a nahrané obrázky do `uploads/`.

## Požiadavky

- Node.js 18+ (bez ďalších závislostí z npm registry).
- `pnpm` (už je definované v `packageManager`, ale nie je nutné pre produkčné spustenie).

## Rýchly štart

```bash
# 1) Nastavte admin token (nepovinné, default je 'changeme-admin-token')
export ADMIN_TOKEN="silne-heslo"

# 2) Spustite server
pnpm start
# alebo
node server.js

# Aplikácia pobeží na http://localhost:3000
```

## SMTP nastavenia (odosielanie formulára emailom)

Backend odošle:
- potvrdenie zákazníkovi,
- kópiu vyplneného formulára firme.

Nastavte tieto premenné prostredia:

```bash
export SMTP_HOST="smtp.vasprovider.sk"
export SMTP_PORT="587"
export SMTP_USER="uzivatel"
export SMTP_PASS="heslo"
export SMTP_SECURE="false" # true pre port 465
export CONTACT_FROM="info@vasadomena.sk"
export CONTACT_TO="info@vasadomena.sk"
export COMPANY_NAME="MV-MONT"
```

Ak nie sú nastavené `CONTACT_FROM` alebo `CONTACT_TO`, server správy uloží, ale emaily neodošle.

## Admin panel galérie

- Otvorte `http://localhost:3000/admin.html`.
- Vložte **X-Admin-Token** (zodpovedá premennnej `ADMIN_TOKEN`) a uložte ho.
- Pridávajte / upravujte / mazaťe položky galérie (URL alebo upload obrázka).
- Všetky zmeny sa okamžite ukladajú do `data/gallery.json`; nahrané súbory do `uploads/`.

## API prehľad

### Kontaktný formulár
- `POST /api/contact` – body: `{ name, email, phone, service, message }`

### Galéria
- `GET /api/gallery` – zoznam položiek
- `POST /api/gallery` – vytvorenie (vyžaduje `X-Admin-Token`)
- `PUT /api/gallery/:id` – úprava (vyžaduje `X-Admin-Token`)
- `DELETE /api/gallery/:id` – odstránenie (vyžaduje `X-Admin-Token`)

Payload pre vytvorenie/úpravu:
```json
{
  "title": "Názov",
  "description": "Popis",
  "category": "frameless|framed|shutters|blinds|terraces|railings|screens",
  "imageUrl": "https://externy.obrazok/optional",
  "imageData": "BASE64_OBSAH",      // alternatíva k imageUrl
  "imageName": "nazov-subaor.png"   // odporúčané pri imageData
}
```

## Úložisko dát („databáza“)

- `data/contacts.json` – prijaté správy
- `data/gallery.json` – položky galérie
- `uploads/` – lokálne uložené obrázky (ak sa posiela `imageData`)

Formát je čitateľný JSON; pri štarte serveru sa súbory automaticky vytvoria.

## Frontend integrácia

- `script.js` načítava galériu z `/api/gallery` a odosiela kontaktný formulár na `/api/contact`.
- `admin.js` obsluhuje admin panel a volá galéria API s hlavičkou `X-Admin-Token`.

## Vývoj

```bash
pnpm lint           # placeholder, vždy vráti „linted“
node --check server.js
```

Stačí spustiť `pnpm start` a otvoriť jednotlivé HTML súbory v prehliadači. Build cez Vite nie je potrebný na funkčnosť backendu/API.
