# Draw or Die

AI destekli mimarlık jüri simülasyonu. Öğrenci pafta/render/PDF yükler, jüri sertliğini seçer, AI’dan değerlendirme alır; sonuçlar Hall of Fame / Wall of Death sistemine bağlanır.

## Özellikler

- Tekli jüri analizi (SINGLE_JURY)
- Revizyon karşılaştırma (REVISION_SAME / REVISION_DIFFERENT)
- Çoklu jüri persona analizi (MULTI_JURY, Premium)
- Premium Rescue (pafta üstü kusur tespiti + çözüm önerileri)
- Jüri Savunması chat akışı (DEFENSE, Premium)
- Auto Concept ve Material Board analizleri
- Rapido ekonomisi, rozetler, progression score
- Appwrite auth/profil akışı, Stripe checkout ve webhook
- Galeri moderasyon akışı (Hall of Fame / Wall of Death)

## Teknoloji

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Zustand state store
- Appwrite (Auth, DB, Storage)
- Stripe (abonelik + kredi satın alma)
- Next API routes üzerinden Gemini/diğer modeller
- pdfjs-dist ile PDF text extraction

## Hızlı Başlangıç

Ön koşul: Node.js 20+

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tarayıcı: `http://localhost:3000`

## NPM Komutları

- `npm run dev` — geliştirme sunucusu
- `npm run lint` — ESLint
- `npm run test` — Jest testleri
- `npm run test:coverage` — coverage
- `npm run typecheck` — TypeScript kontrolü
- `npm run build` — production build
- `npm run test:e2e:smoke` — Playwright e2e smoke

## Ortam Değişkenleri

Detaylar için:

- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)
- [`docs/v2.0-baseline-audit.md`](docs/v2.0-baseline-audit.md)

Temel değişkenler `.env.example` içinde listelidir.

## Dokümantasyon

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/API.md`](docs/API.md)
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)
- [`docs/v2.0-baseline-audit.md`](docs/v2.0-baseline-audit.md)

## Güvenlik Notları

- PDF yüklemeleri MIME, boyut ve imza (magic bytes) kontrollerinden geçer.


