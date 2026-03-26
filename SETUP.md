# Alpha Bail Bonds AI Caller — Setup Guide

## Local Development

### Prerequisites
- Node.js 20+
- A PostgreSQL database (options below)

### Option A — Free Neon PostgreSQL (Recommended)
1. Go to [neon.tech](https://neon.tech) → sign up free
2. Create a new project (takes 10 seconds)
3. Copy the connection string from the dashboard
4. Paste it into `.env.local` as `DATABASE_URL`

### Option B — Local PostgreSQL
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/alpha_bail_bonds
```

### First-time setup
```bash
npm install
npx prisma db push          # creates tables in your PostgreSQL database
npx prisma db seed          # creates the test agent: admin@alpha.com / password123
npm run dev
```

Open http://localhost:3000 — login with `admin@alpha.com` / `password123`

---

## Deploy to Netlify

### Step 1 — Get a PostgreSQL Database
**Option A: Neon (free, recommended)**
1. Go to [neon.tech](https://neon.tech) → sign up
2. Create a project → copy the **connection string** (looks like `postgresql://...`)

**Option B: Netlify DB (auto-provisioned)**
1. In Netlify UI → your site → Integrations → Netlify DB → Enable
2. Netlify sets `NETLIFY_DATABASE_URL` automatically
3. In Netlify UI → Environment Variables → add:
   `DATABASE_URL` = (copy the value of NETLIFY_DATABASE_URL from the same page)

### Step 2 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/alpha-bail-bonds.git
git push -u origin main
```

### Step 3 — Connect to Netlify
1. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`

### Step 4 — Set Environment Variables in Netlify
In Netlify UI → Site → Environment Variables, add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon/PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Any random 32-char string |
| `NEXTAUTH_URL` | `https://your-site-name.netlify.app` |
| `VONAGE_API_KEY` | From Vonage dashboard |
| `VONAGE_API_SECRET` | From Vonage dashboard |
| `VONAGE_FROM_NUMBER` | Your Vonage phone number |
| `VAPI_API_KEY` | From Vapi dashboard |
| `VAPI_PHONE_NUMBER_ID` | From Vapi dashboard |
| `AGENT_FORWARD_PHONE` | Phone to forward inbound SMS to |

### Step 5 — Seed the Database After First Deploy
After first successful deploy, run this locally pointing at your production DB:
```bash
DATABASE_URL="your-neon-connection-string" npx prisma db seed
```

### Step 6 — Set Up Webhooks
In your Vapi and Vonage dashboards, set webhook URLs to:
- Vapi end-of-call: `https://your-site.netlify.app/api/webhooks/vapi`
- Vonage inbound SMS: `https://your-site.netlify.app/api/webhooks/vonage`

---

## How the Batch Processor Works on Netlify
The `netlify/functions/batch-processor.mts` scheduled function runs automatically every 2 minutes on Netlify. It processes any pending call queue entries. No server management needed.

## API Keys You Need
| Service | Free Tier | Get It At |
|---------|-----------|-----------|
| Neon (PostgreSQL) | 512MB free forever | neon.tech |
| Vonage (SMS) | $2 free credit | vonage.com |
| Vapi (AI Calls) | $10 free credit | vapi.ai |
