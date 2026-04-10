# Draw or Die — Ortam Değişkenleri

## `.env.local` (Next.js)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# App
NEXT_PUBLIC_APP_URL=https://drawordie.ackaraca.me
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=draw-or-die
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Appwrite server-side
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=draw-or-die
APPWRITE_API_KEY=your-appwrite-server-api-key

# Optional: dedicated provider for edu verification emails
# If empty, default configured email provider is used.
APPWRITE_EDU_EMAIL_PROVIDER_ID=your-email-provider-id
```

## Supabase Edge Function Secrets

| Secret | Değer | Nereden |
|--------|-------|---------|
| `AI_API_KEY` | AI sağlayıcı API Key | Sağlayıcıya göre değişir |
| `AI_BASE_URL` | OpenAI-uyumlu endpoint | Varsayılan: `https://ai-gateway.vercel.sh/v1` |
| `AI_MODEL` | Model tanımlayıcı | Varsayılan: `google/gemini-3.1-pro` |
| `ALLOWED_ORIGINS` | CORS allowlist (virgülle ayrılmış) | Örn: `https://drawordie.ackaraca.me,https://www.drawordie.ackaraca.me` |

Otomatik (Supabase tarafından sağlanır):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Güvenlik Kuralları

1. **Asla** API anahtarlarını kod içinde, commit içinde veya sohbet/ekran paylaşımında tutmayın.
2. Eğer Stripe veya diğer API anahtarları ifşa olduysa, hemen ilgili panelden **rotate** (yenile) yapın.
3. `SUPABASE_SERVICE_ROLE_KEY` sadece server-side (API routes, webhook, edge function) kullanılmalı.
4. `NEXT_PUBLIC_*` değişkenleri client tarafına expose edilir; hassas bilgi içermemeli.
5. Stripe secret key (`sk_live_`) sadece server-side kullanılmalı.
6. `ALLOWED_ORIGINS` içinde wildcard (`*`) kullanmayın.

## 503 Checkout Hatası

Bu hata genellikle `STRIPE_SECRET_KEY`'in Vercel ortam değişkenlerinde tanımlı olmamasından kaynaklanır. Vercel → Settings → Environment Variables → `STRIPE_SECRET_KEY` ekleyin.
