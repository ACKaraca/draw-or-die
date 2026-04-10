# Draw or Die — Documentation

Bu klasör, projenin mimarisi, deployment, kurulum ve API dokümantasyonunu içerir.

## İçindekiler

| Belge | Açıklama |
|-------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Genel mimari, bileşenler, veri akışı |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Ortam değişkenleri ve gizli anahtarlar |
| [API.md](./API.md) | API endpointleri ve Edge Function |

## Hızlı Başlangıç

1. `.env.example` dosyasını `.env.local` olarak kopyalayın
2. Supabase ve Stripe anahtarlarını doldurun
3. `supabase functions deploy ai-generate` ile Edge Function deploy edin
4. `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`'i Supabase Dashboard → Edge Functions → Secrets'a ekleyin
5. Vercel'de `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` tanımlayın

