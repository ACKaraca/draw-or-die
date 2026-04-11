# Draw or Die

> AI destekli mimarlık jüri simülasyonu — öğrenciler için pafta analizi, revizyon karşılaştırma, jüri savunması ve topluluk galerisi.

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [NPM Komutları](#npm-komutları)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Rapido Ekonomisi](#rapido-ekonomisi)
- [Fiyatlandırma Katmanları](#fiyatlandırma-katmanları)
- [Analiz Modları](#analiz-modları)
- [Güvenlik](#güvenlik)
- [Dokümantasyon](#dokümantasyon)

---

## Genel Bakış

**Draw or Die**, mimarlık öğrencilerinin pafta, render, CAD çıktısı veya PDF yükleyerek AI destekli jüri eleştirisi almasını sağlar. Uygulama; tekli jüri analizinden çoklu persona geri bildirimlerine, premium kurtarma analizinden jüri savunma chatına uzanan çeşitli modlarla gamified bir öğrenme deneyimi sunar.

Kullanıcı yolculuğu:
1. **Landing & Auth** — Kullanıcı siteye girer, genel galeriyi inceleyebilir veya Appwrite Auth ile giriş/kayıt yapar.
2. **Yükleme & Form** — Pafta/render/PDF yüklenir. Form ile konu, konsept, kategori girilir.
3. **AI Jüri** — Seçilen mod (Tekli, Çoklu, Premium Rescue vb.) için `/api/ai-generate` çağrılır, Rapido düşülür.
4. **Sonuç & Savunma** — Yapılandırılmış JSON eleştirisi gösterilir; opsiyonel olarak çok turlu savunma chati başlatılır.
5. **Galeri** — Sonuç Hall of Fame veya Wall of Death'e yayınlanabilir (moderasyon onayıyla).

---

## Özellikler

### Analiz Modları
| Mod | Açıklama | Rapido Maliyeti |
|-----|----------|-----------------|
| `SINGLE_JURY` | Tek jüri persona analizi | 4 |
| `REVISION_SAME` | Aynı proje revizyonu | 1 |
| `REVISION_DIFFERENT` | Farklı proje revizyonu | 2 |
| `MULTI_JURY` | 3 persona eş zamanlı analiz (Premium) | 10 |
| `MULTI_JURY_REVISION` | Çoklu jüri revizyon (Premium) | 2 |
| `PREMIUM_RESCUE` | Pafta üzerinde kusur tespiti + çözüm | 6 |
| `AUTO_CONCEPT` | Otomatik konsept üretimi | 5 |
| `MATERIAL_BOARD` | Malzeme analizi (Premium) | 3 |
| `DEFENSE` | Jüri savunması chat (Premium) | 4/tur |
| `AI_MENTOR` | AI Mentor mesajı (Premium) | 1/mesaj |

### Jüri Personaları
- **Constructive** — Yapıcı, gelişim odaklı
- **Structural** — Strüktür ve teknik odaklı
- **Conceptual** — Kavram ve fikir odaklı
- **Grumpy** — Acımasız, sert eleştirmen
- **Contextualist** — Bağlam ve çevre odaklı
- **Sustainability** — Sürdürülebilirlik odaklı

### Gamification
- **Rozet sistemi** — Analiz sayısına ve sonuçlara göre açılan başarımlar
- **Progression Score** — Kümülatif XP puanı
- **Wall of Death Count** — Aldığı acımasız eleştiri sayacı
- **Leaderboard** — Topluluk sıralaması

### Topluluk
- **Hall of Fame** — Başarılı paftaların sergilendiği galeri
- **Wall of Death** — En sert eleştiri alan paftaların galerisü
- **Moderasyon akışı** — Yayın öncesi içerik onayı

### Hesap & Ekonomi
- Kayıt sonrası 15 ücretsiz Rapido
- Referral sistemi — ikili Rapido ödülü
- Promo kodu desteği
- Edu e-posta doğrulama ile indirimli fiyatlandırma
- Stripe abonelik ve kredi paketi satın alımı

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Stil | Tailwind CSS, Framer Motion |
| State | Zustand |
| Backend/Auth/DB | Appwrite (Auth, Databases, Storage) |
| AI/LLM | Google Gemini (Next.js API proxy üzerinden) |
| PDF İşleme | pdfjs-dist |
| Ödeme | Stripe (abonelik + kredi) |
| Test | Jest (unit), Playwright (e2e) |
| CI/CD | GitHub Actions |
| Analytics | Google Analytics, özel growth tracking |

---

## Proje Yapısı

```
DrawOrDie/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Ana orkestratör — tüm step'leri yönetir
│   ├── api/
│   │   ├── ai-generate/        # AI jüri proxy + Rapido düşümü
│   │   ├── checkout/           # Stripe Checkout oturumu oluşturma
│   │   ├── webhook/stripe/     # Stripe webhook (ödeme onayı)
│   │   ├── gallery/            # Galeri gönderme + listeleme
│   │   ├── analysis-history/   # Analiz geçmişi CRUD
│   │   ├── mentor/chats/       # AI Mentor chat oturumları
│   │   ├── profile/            # Profil okuma/güncelleme
│   │   ├── referral/           # Referral link + uygulama
│   │   ├── promos/             # Promo kodu redeem
│   │   ├── billing/            # Fatura geçmişi + portal
│   │   ├── verify-edu/         # Edu e-posta doğrulama
│   │   └── growth/             # Büyüme analitiği
│   ├── auth/                   # Giriş, kayıt, şifre sıfırlama
│   ├── gallery/                # Genel galeri sayfaları
│   ├── community/              # Topluluk sayfası
│   ├── history/                # Analiz geçmişi sayfası
│   ├── profile/                # Profil sayfası
│   ├── mentor/                 # AI Mentor sayfası
│   └── shop/                   # Rapido & Premium satın alma
│
├── components/
│   ├── steps/                  # State machine step bileşenleri
│   │   ├── HeroStep.tsx
│   │   ├── UploadStep.tsx
│   │   ├── AnalyzingSteps.tsx
│   │   ├── ResultStep.tsx
│   │   ├── PremiumResultStep.tsx
│   │   ├── MultiResultStep.tsx
│   │   ├── GalleryStep.tsx
│   │   └── AIMentorStep.tsx
│   ├── StepRouter.tsx          # Step yönlendirme mantığı
│   ├── AuthModal.tsx
│   ├── ChatDefense.tsx
│   ├── Header.tsx
│   └── SiteFooter.tsx
│
├── lib/
│   ├── ai.ts                   # AI model entegrasyonu
│   ├── critique.ts             # Eleştiri üretim mantığı
│   ├── pricing.ts              # Rapido maliyetleri + Stripe fiyatları
│   ├── promo-codes.ts          # Promo kodu doğrulama + redeem
│   ├── referral.ts             # Referral sistemi
│   ├── appwrite/               # Appwrite SDK istemci + sunucu
│   ├── rate-limit.ts           # API rate limiting
│   ├── growth-tracking.ts      # Büyüme analitiği
│   ├── step-routing.ts         # Step geçiş mantığı
│   └── i18n.ts                 # Çoklu dil desteği
│
├── stores/
│   └── drawOrDieStore.ts       # Merkezi Zustand store
│
├── hooks/
│   ├── useAnalysis.ts          # Çekirdek analiz hook
│   ├── useAuth.tsx             # Kimlik doğrulama hook
│   ├── useDropHandler.ts       # Dosya yükleme/bırakma
│   ├── useGallery.ts           # Galeri veri hook
│   └── useGuestRapido.ts       # Misafir ekonomi takibi
│
├── types/
│   └── index.ts                # TypeScript tip tanımları
│
├── __tests__/                  # Jest unit testleri
├── tests/                      # Playwright e2e testleri
├── docs/                       # Detaylı dokümantasyon
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ENVIRONMENT.md
└── .github/workflows/          # CI/CD pipeline'ları
```

---

## Hızlı Başlangıç

**Gereksinimler:** Node.js 20+

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini kopyala ve doldur
cp .env.example .env.local

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıda aç: `http://localhost:3000`

---

## NPM Komutları

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint kontrolü |
| `npm run test` | Jest unit testleri |
| `npm run test:coverage` | Test coverage raporu |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run test:e2e:smoke` | Playwright e2e smoke test |

---

## Ortam Değişkenleri

Tüm ortam değişkenleri `.env.example` dosyasında listelenmiştir. Detaylı açıklama için [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) dosyasına bakın.

Kritik değişkenler:

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_APPWRITE_*` | Appwrite proje bağlantı bilgileri |
| `AI_API_KEY` | Gemini / AI model API anahtarı |
| `STRIPE_SECRET_KEY` | Stripe gizli anahtar |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook imza doğrulama |
| `NEXT_PUBLIC_APP_URL` | Uygulama base URL |

---

## Rapido Ekonomisi

**Rapido**, platformun sanal para birimidir (kalem metaforu). Her AI analiz operasyonu bir miktar Rapido tüketir.

### Kullanıcı Tipleri ve Başlangıç Rapido

| Tip | Başlangıç Rapido |
|-----|-----------------|
| Misafir (giriş yapmamış) | 4 |
| Anonim oturum | 4 |
| Kayıtlı kullanıcı | 15 |
| Premium abone | 200 |

### Promosyonlar

- **Referral**: Her iki taraf +5 Rapido kazanır
- **İlk 30 kayıt**: +20 Rapido bonus
- **Promo kodu**: Özel kampanyalarla ek Rapido veya Premium erişim
- **Edu e-posta**: İndirimli abonelik fiyatları

### Satın Alma

Rapido paketleri ve Premium abonelik Stripe Checkout üzerinden satın alınabilir. Fiyatlar kullanıcının e-posta tipine göre otomatik belirlenir:

| Segment | Aylık | Yıllık |
|---------|-------|--------|
| Akdeniz Öğrencisi | 149 TL | 1249 TL |
| TR Öğrencisi (.edu.tr) | 299 TL | 2499 TL |
| Global | $15 | $129 |

---

## Analiz Modları

### Tekli Jüri (`SINGLE_JURY`)
Seçilen bir jüri personasından tek turlu detaylı eleştiri. Harshness slider (1-5) eleştiri sertliğini ayarlar.

### Çoklu Jüri (`MULTI_JURY`) — Premium
Üç farklı jüri personası eş zamanlı olarak farklı açılardan eleştiri sunar.

### Premium Rescue (`PREMIUM_RESCUE`) — Premium
AI, pafta üzerindeki problemleri bounding-box koordinatlarıyla işaretler ve her hata için pratik çözüm önerir.

### Jüri Savunması (`DEFENSE`) — Premium
Çok turlu chat modu. AI jüri rolünde kalır; kullanıcı projesini savunur, AI argüman üretir.

### Revizyon Analizi
Önceki eleştirinin ışığında revize edilen paftanın karşılaştırmalı değerlendirmesi. Aynı veya farklı proje tespiti yapılır.

### AI Mentor (`AI_MENTOR`) — Premium
Serbest format mimarlık danışmanı. Token bazlı Rapido faturalandırması.

---

## Güvenlik

- **Dosya yükleme**: MIME tipi, boyut limiti ve magic bytes (dosya imzası) doğrulaması.
- **AI proxy**: Tüm AI çağrıları sunucu taraflı rotadan geçer; istemci asla AI API anahtarına erişemez.
- **Rapido düşümü**: İstemci kendi bakiyesini asla doğrudan değiştiremez; sunucu tüm bakiye işlemlerini yürütür.
- **Stripe webhook**: `stripe-signature` başlığı ile tüm gelen webhook'lar doğrulanır.
- **Rate limiting**: Kullanıcı bazlı API istek sınırlaması (`lib/rate-limit.ts`).
- **Auth**: Tüm korumalı rotalar geçerli Appwrite JWT gerektirir.
- **İdempotency**: Stripe event'leri `stripe_events` tablosunda tutulur; tekrar işlem önlenir.

---

## Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Sistem mimarisi, veri modeli, AI akışı |
| [`docs/API.md`](docs/API.md) | Tüm API endpoint referansı |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Ortam değişkenleri detay |
| [`WHATSAPP_TANITIM.md`](WHATSAPP_TANITIM.md) | Tanıtım metinleri |
