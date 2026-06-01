# TechAnalysis Pro — SaaS Technical Analysis Report Platform

## 🚀 Quick Start

### Prerequisites

Install these before running:
1. **Node.js** v18+ (already installed ✅)
2. **PostgreSQL** v14+ — [Download PostgreSQL](https://www.postgresql.org/download/windows/)
3. **Redis** (optional, for production queue) — [Download Redis for Windows](https://github.com/microsoftarchive/redis/releases)

---

## 📦 Installation

### 1. Database Setup

After installing PostgreSQL:
```bash
# Connect to PostgreSQL and create the database
psql -U postgres -c "CREATE DATABASE techanalysis_db;"
```

### 2. Backend Setup
```bash
cd backend
copy .env.example .env
# Edit .env with your PostgreSQL credentials and API keys
npm install
npm start       # Production
npm run dev     # Development (with nodemon hot-reload)
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev     # Development (http://localhost:3000)
npm run build   # Production build
npm start       # Start production server
```

---

## 🐳 Docker (Recommended — No Manual DB Setup)

```bash
# Copy environment file first
copy backend\.env.example backend\.env

# Start everything (PostgreSQL + Redis + Backend + Frontend)
docker-compose up -d

# View logs
docker-compose logs -f backend
```

Then open: http://localhost:3000

---

## 🔧 Environment Variables

Edit `backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techanalysis_db
DB_USER=postgres
DB_PASSWORD=yourpassword

# JWT (change this!)
JWT_SECRET=your-strong-random-secret-key

# Market Data
MARKET_DATA_PROVIDER=twelvedata
MARKET_DATA_FALLBACK_PROVIDER=tradingview
TWELVE_DATA_API_KEY=your_twelve_data_api_key

# Email (for report delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password   # Google App Password

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PDF Generation — set path to Chrome/Chromium
CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

---

## 📊 Features

### Core System
| Feature | Description |
|---------|-------------|
| **Market Data** | Twelve Data with TradingView fallback for unresolved symbols |
| **Indicators** | RSI-14, MACD, EMA-50/200, Bollinger Bands, ATR-14 |
| **S/R Detection** | Automatic swing high/low detection |
| **Fibonacci** | Auto-calculated retracement levels |
| **Trend Structure** | HH/HL/LH/LL pattern detection |
| **Breakout Detection** | S/R level breakout alerts |
| **Commentary** | Institutional-grade rule-based analysis text |
| **Charts** | Canvas-based candlestick charts with overlays |
| **PDF Reports** | Multi-page branded Puppeteer PDF generation |
| **Email Delivery** | Nodemailer SMTP email with PDF attachment |
| **Scheduler** | node-cron daily report scheduling per tenant |

### SaaS Features
| Feature | Description |
|---------|-------------|
| **Multi-Tenant** | Each company has isolated data via `tenant_id` |
| **Role-Based Access** | super_admin, admin, analyst, subscriber |
| **Subscription Plans** | Free, Basic, Pro, Premium |
| **Stripe Integration** | Checkout sessions, billing portal, webhooks |
| **Custom Branding** | PDF color, logo, company name, footer |

---

## 📁 Directory Structure

```
Technical report/
├── backend/                    # Node.js/Express API
│   ├── server.js               # Entry point
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   │   ├── auth.js        # Login, register, /me
│   │   │   ├── assets.js      # Market symbols management
│   │   │   ├── reports.js     # PDF reports + generation
│   │   │   ├── subscribers.js # Email list management
│   │   │   ├── admin.js       # Tenant settings
│   │   │   ├── superAdmin.js  # Platform-wide admin
│   │   │   ├── scheduler.js   # Schedule configuration
│   │   │   ├── stripe.js      # Billing & Stripe webhooks
│   │   │   └── dashboard.js   # Stats API
│   │   ├── core/
│   │   │   ├── database.js    # Sequelize PostgreSQL
│   │   │   └── logger.js      # Winston logger
│   │   ├── models/
│   │   │   └── index.js       # Tenant/User/Asset/Report models
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT auth + role guards
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   ├── market_data/   # Twelve Data + TradingView fallback
│   │   │   ├── indicators/    # TA calculations (RSI/MACD/EMA...)
│   │   │   ├── commentary/    # Rule-based text generator
│   │   │   ├── charts/        # Canvas candlestick charts
│   │   │   ├── pdf/           # Puppeteer PDF builder
│   │   │   └── email/         # Nodemailer sender
│   │   └── tasks/
│   │       ├── reportGenerator.js  # Main pipeline orchestrator
│   │       └── scheduler.js        # node-cron daily scheduler
│   ├── reports/               # Generated PDF files
│   ├── charts/                # Generated chart images
│   └── logs/                  # Application logs
│
├── frontend/                   # Next.js 14 Application
│   ├── app/                   # App Router
│   │   ├── (app)/             # Protected routes (sidebar layout)
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── reports/       # Reports list + generate
│   │   │   ├── assets/        # Market symbols config
│   │   │   ├── subscribers/   # Email subscriber list
│   │   │   ├── scheduler/     # Schedule settings
│   │   │   ├── settings/      # PDF branding config
│   │   │   ├── billing/       # Stripe plans & billing
│   │   │   └── super-admin/   # Platform admin views
│   │   ├── login/             # Login page
│   │   └── register/          # Registration page
│   ├── components/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── QueryClientWrapper.tsx
│   └── lib/
│       ├── api.ts             # Axios API client
│       └── auth-context.tsx   # Auth state management
│
└── docker-compose.yml          # Full stack Docker setup
```

---

## 🔐 Default Accounts

After registration, you'll be the admin of your tenant.

To create a Super Admin:
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';
```

---

## 📄 PDF Report Structure

Each generated report includes:
1. **Cover Page** — Branded, with asset list and date
2. **Market Summary Table** — All assets with bias, confidence, RSI, trend
3. **Per-Asset Pages** (one per symbol):
   - Asset header with price + change
   - Candlestick chart with S/R overlays
   - RSI, MACD, EMA, BB indicator tiles
   - 5-section analysis (Market Overview, Technical Structure, Indicator Confirmation, Key Levels, Trading Outlook)
   - Entry / Stop Loss / Take Profit levels
   - Risk disclaimer

---

## 💡 Report Generation

Reports can be triggered:
- **Manually** from the Reports page (Generate Now button)
- **Automatically** via daily cron at the configured time
- **Via API**: `POST /api/reports/generate-sync`

**Generation flow:**
1. Fetch daily OHLCV data from the configured market-data provider for all eligible assets
2. Calculate all technical indicators (RSI, MACD, EMA, BB, ATR, S/R, Fibonacci)
3. Determine trade bias (Bullish/Bearish/Neutral) from indicator signals
4. Generate candlestick charts with Canvas API
5. Write institutional commentary from rule templates
6. Build multi-page PDF with Puppeteer/Chromium
7. Email PDF to all active subscribers

---

## 🛠 Supported Market Data Symbols

| Asset | Symbol |
|-------|--------|
| EUR/USD | `EUR/USD` |
| GBP/USD | `GBP/USD` |
| USD/JPY | `USD/JPY` |
| USD/CHF | `USD/CHF` |
| AUD/USD | `AUD/USD` |
| Gold | `XAU/USD` |
| Dow Jones | `^DJI` |
| S&P 500 | `^GSPC` |
| Nasdaq 100 | `^NDX` |
| Bitcoin | `BTC/USD` |
| Ethereum | `ETH/USD` |
