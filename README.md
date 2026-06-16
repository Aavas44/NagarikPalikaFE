# Nagarik Palika — Frontend

Next.js 15 user and admin portal for **Nagarik Palika**: government terminology, Saral Sewa categories, calculators, templates, and advocate consultations.

This folder is **self-contained** and can be deployed on its own (e.g. copy or submodule from the monorepo). Glossary data is bundled under `data/`.

## Requirements

- Node.js 18+
- A running [Nagarik Palika API](https://github.com/) (Express backend) for auth, content, consultations, and reference data

## Setup

```bash
cp .env.example .env.local
# Edit API_URL to your backend URL in production

npm install
npm run dev
```

Open http://localhost:3000

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | Yes (production) | `http://127.0.0.1:4000` | Backend base URL for SSR and `/api/*` rewrites |
| `DATA_DIR` | No | `./data` | Directory containing bundled glossary JSON files |

Browser requests use relative `/api/*` paths, which Next.js rewrites to `API_URL`. Server components fetch `API_URL` directly.

## Bundled data (`data/`)

| File | Used for |
|------|----------|
| `kanuni-shabdakosh-glossary-roman-fixed.json` | Terminology search (`/terminology`, `/api/glossary`) |
| `saralsewa-nepali-government-glossary.json` | Home categories and `/categories/[slug]` |

Provinces, specialties, templates, and other dynamic content come from the backend API.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run clean` | Remove `.next` cache |

## Deploy (e.g. Vercel)

1. Deploy this folder (monorepo path: `frontend/`, or as a standalone repo).
2. Set **Root Directory** to `.` (repo root).
3. **Build command:** `npm run build`
4. **Output:** Next.js default
5. **Environment:** `API_URL=https://your-api.example.com`
6. On the backend, set `FRONTEND_URL` to your deployed frontend URL (CORS + Google OAuth redirects).

Calculators (EMI, salary tax, land converter) run entirely in the browser — no API needed.

## Structure

```
├── data/              # Bundled glossary JSON
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # UI components
│   ├── lib/           # API client, calculators, glossary loaders
│   ├── i18n/          # English + Nepali strings
│   └── types/
├── next.config.js     # API rewrites to backend
└── package.json
```
