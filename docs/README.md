# Draw or Die — Documentation

This folder contains architecture, deployment, setup, and API documentation for the project.

## Contents

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, components, and data flow |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Environment variables and secret keys |
| [API.md](./API.md) | API endpoints and route contracts |

## Quick Start

1. Copy `.env.example` to `.env.local` and fill in the required values.
2. Add Appwrite and Stripe credentials (see [ENVIRONMENT.md](./ENVIRONMENT.md) for details).
3. Set `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL` as server-side environment variables in Vercel.
4. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APPWRITE_API_KEY` in Vercel Dashboard → Settings → Environment Variables.
5. For Appwrite auto-deploys, set `APPWRITE_PROD_SITE_ID` and `APPWRITE_DEV_SITE_ID` as GitHub repository variables, or keep `APPWRITE_SITE_ID` as the shared fallback.
6. Run `npm run dev` to start the development server.
