# Deletion Candidates (Session 1)

Tarih: 2026-04-16
Durum: In Review

Bu liste DrawOrDie docs klasoru icin stale olabilecek dokumanlari izlemek icindir.

## High Priority Doc Fixes Completed In Session 1
1. `ARCHITECTURE.md` icindeki Supabase referanslari Appwrite gercegiyle duzeltildi.

## Session 3 Completed
1. `docs/internal/WHATSAPP_TANITIM.md` -> `docs/_archive/marketing/WHATSAPP_TANITIM.md`
2. `docs/internal/hero-mock-visuals.md` -> `docs/_archive/design/hero-mock-visuals.md`
3. Root `env.md` dosyasi kaldirildi (secret exposure risk nedeniyle)

## Pending Review Candidates
1. `docs/internal/studio_desk_release_a_reliability_ux_performance.plan.md`
2. `docs/internal/studio_desk_reliability_archbuilder_master.plan.md`
3. `docs/internal/studio_desk_release_b_archbuilder_mvp.plan.md`
- Gerekce: Aktif release planlari, su an arsivlenmeyecek; release kapanisinda final snapshot ile tasinacak.

4. `docs/internal/i18n_uyumsuzluk_taramasi_a31b5612.plan.md`
- Gerekce: Uzun sureli takip dosyasi; tamamlanma oranina gore parcali arsivleme karari verilecek.

## Session 2-3 Eylem Kurali
Bir dosya ancak su kosullarda silinir:
1. Daha guncel bir authoritative dokuman tarafindan supersede edilmisse
2. Repo icinde aktif referans verilmiyorsa
3. Gerekirse `_archive` altinda saklanmis kopyasi varsa
