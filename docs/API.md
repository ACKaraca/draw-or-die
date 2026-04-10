# Draw or Die — API

## Next.js API Routes

### POST /api/checkout

Stripe Checkout session oluşturur.

**Auth:** Supabase oturumu zorunlu (server-side user kontrolü)

**Body:**
```json
{
  "mode": "premium_monthly" | "premium_yearly" | "rapido_pack",
  "quantity": 5  // sadece rapido_pack için
}
```

**Response (200):**
```json
{ "url": "https://checkout.stripe.com/..." }
```

**Hatalar:**
- `401` — Giriş gerekli
- `400` — Geçersiz checkout mode
- `429` — Rate limit
- `503` — Stripe yapılandırması eksik (`STRIPE_SECRET_KEY`)
- `500` — Beklenmeyen checkout hatası

---

### POST /api/webhook/stripe

Stripe webhook endpoint. Stripe Dashboard'dan yapılandırılır.

**Headers:** `stripe-signature` (Stripe imza)

**İşlenen eventler:**
- `checkout.session.completed` — Premium aktivasyonu, Rapido ekleme
- `customer.subscription.deleted` — Premium iptali
- `invoice.payment_failed` — Log kaydı

**Notlar:**
- `stripe_events` tablosu ile idempotency uygulanır (duplicate event skip).
- İmza doğrulaması başarısızsa `400` döner.

---

## Supabase Edge Function

### POST /functions/v1/ai-generate

AI jüri analizi.

**Headers:** `Authorization: Bearer <supabase_access_token>`

**Body:**
```json
{
  "operation": "SINGLE_JURY" | "PREMIUM_RESCUE" | "REVISION_SAME" | "MULTI_JURY" | "DEFENSE" | "AI_MENTOR" | "AUTO_CONCEPT" | "MATERIAL_BOARD",
  "imageBase64": "base64_encoded_image_data",
  "imageMimeType": "image/jpeg | image/png | application/pdf",
  "params": {
    "topic": "string",
    "category": "string",
    "harshness": 1-5,
    "pdfText": "string",
    "previousCritique": "string",
    "userMessage": "string",
    "chatHistory": "string",
    "turnCount": 0-3
  }
}
```

**Response (200):**
```json
{
  "result": "string (JSON)",
  "rapido_remaining": 28,
  "game_state": {
    "progression_score": 0,
    "wall_of_death_count": 0,
    "earned_badges": [],
    "new_badges": []
  }
}
```

**Hatalar:**
- `401` — Geçersiz veya eksik JWT
- `402` — Yetersiz Rapido (`INSUFFICIENT_RAPIDO`)
- `403` — Premium gerekli (`PREMIUM_REQUIRED`)
- `429` — Rate limit
- `503` — AI_API_KEY eksik
- `500` — Edge function işleme hatası
