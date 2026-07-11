<div align="center">

# 📊 PortfolioLab

### Web platform for portfolio analysis and optimization

Modern portfolio optimization (Markowitz, Risk Parity, CVaR), robo-advisor-style financial planning, and Morningstar-style visual analytics on real market data.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-68%20passing-2DD4A7)
![License](https://img.shields.io/badge/license-academic%20use-blue)

**Bachelor's Thesis (TFG) · Computer Engineering · University of Málaga · 2026**

### 🔗 [**Live demo →**](https://tfg-optimizacion-carteras-nine.vercel.app)

<sub>The demo runs on free-tier hosting; the first request after a while may take ~30–50 s to wake up.</sub>

</div>

---

> ### ⚠️ Disclaimer
> **PortfolioLab is an academic project built for educational and technical-demonstration purposes only.** It does **not** constitute financial, tax, or investment advice, nor a recommendation to buy or sell any asset. All calculations rely on third-party historical data and simplified models; past performance does not guarantee future results. The author accepts no liability for decisions made using this tool. Always consult a licensed financial advisor before investing.

---

<!--
📸 "HERO" SCREENSHOT — add a wide image of the Optimizer or the X-Ray here.
Save it to docs/screenshots/hero.png and uncomment the line below:
-->
<!-- ![PortfolioLab](docs/screenshots/hero.png) -->

## ✨ Features

### 🎯 Optimizer with 5 methods
| Method | Objective function | When to use it |
|---|---|---|
| **Sharpe (Markowitz)** | Maximizes return/risk under a volatility constraint | Classic "optimal" portfolio |
| **Minimum variance** | Minimizes overall volatility | Very conservative investor |
| **Risk Parity (ERC)** | Equalizes each asset's risk contribution | Effective diversification (Maillard-Roncalli 2010) |
| **Minimum CVaR** | Minimizes the mean loss in the worst 5 % of days | Tail-loss aversion (Rockafellar-Uryasev 2000) |
| **Equal Weight (1/N)** | Equal weights, no optimization | Naive baseline (DeMiguel et al. 2009) |

For each result, **6 comparable metrics** are computed: Sharpe, Diversification Ratio (Choueifaty), concentration HHI, effective number of assets (1/HHI), 95 % CVaR, and dividend-weighted yield.

Visualizations: Markowitz **efficient frontier** (50 points) + **Sharpe-vs-Sortino Pareto frontier** (θ scalarization).

### 📋 Financial planner (robo-advisor mode)
- Inputs: cash, monthly expenses, age, horizon, risk profile, desired emergency fund.
- Outputs: investable capital, suggested asset allocation (cash/bonds/equity/RE/commodities) using the **"rule of 110"** modulated by profile and horizon.
- "Apply to Optimizer" button that pre-fills capital and shows the recommended allocation.

### 📈 Historical backtesting
- 8 metrics: cumulative return, annualized return, volatility, **Sharpe, Sortino, Calmar**, maximum drawdown, beta vs SPY.
- Periods: YTD, 1y, 3y, 5y, 10y, 20y, max + **custom date range**.
- **Crisis analysis**: COVID 2020, Lehman 2008-09, 2022 correction — separate metrics for each period.
- **Periodic rebalancing** (monthly / quarterly / semiannual / annual) with day-by-day simulation.
- **Realistic commissions** modeled via turnover (low-cost broker ≈ 0.1 %, traditional bank ≈ 0.5 %).
- **Price vs dividend decomposition**: shows what share of the return comes from appreciation and how much from reinvested dividends, with annual income in €.

### 🔬 X-Ray (portfolio analysis)
- **Asset-class breakdown** (Equity / Bonds / Real Estate / Commodities / Cash / Alternatives) as a stacked bar.
- **Sectors** (donut + bars).
- **Geography**: world choropleth map with per-country tooltip.
- **Morningstar Style Box** 3×3 (Market cap × Value/Blend/Growth style).
- **Distributions** by market cap (Large/Mid/Small) and style.
- **Asset type** (Cyclical/Sensitive/Defensive) following Morningstar's classification.
- **Dividend analysis**: weighted yield, top contributors, payment frequency.
- **Version history** (snapshots): timeline with diffs between edits of each portfolio.

### 🎲 Monte Carlo projection
- **Historical bootstrap** (resampling real daily returns with replacement) — preserves the fat tails and skew that a normal distribution erases.
- 1,000 / 5,000 / 10,000 simulations × up to 30 years (NumPy-vectorized: 5,000×10y in ~270 ms).
- Outputs: temporal percentiles 5/25/50/75/95, median CAGR + percentiles, final-value distribution, **key probabilities** (loss, doubling, tripling capital).
- Visualization: **fan chart** with 50 % and 90 % uncertainty bands, log-scaled histogram of the final value.

### 🆚 Comparator
Up to 4 saved portfolios side by side: overlaid equity curves (base 100), an 8-metric comparison table, and composition side by side.

### 📚 Template catalog (13 well-known portfolios)
- Conservative: Global 60/40 · Dividend defensive · Bond Ladder · **Permanent Portfolio (Browne)** · Income Utilities & REITs.
- Moderate: Core S&P + International · Balanced sectors · US Blue Chips · **All Weather (Ray Dalio)** · Income with bonds + dividends.
- Aggressive: Mega-cap Tech · Disruption · Semis + Emerging.

Filtered by the user's profile detected in the Planner, with a "Show all" toggle.

### 🎨 UX
- 6 swappable CSS themes (Dark, Navy, Light, Rose, Emerald, Amber).
- Fixed side navigation with 6 modules: Planner → Optimizer → X-Ray → Backtesting → Projection → Comparator.
- JWT auth with auto-logout on expiration.
- In-place editing of saved-portfolio weights with automatic normalization.

---

## 💻 Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · React Router · Recharts · react-simple-maps · Axios |
| **Backend** | Python 3.11 · FastAPI · SQLAlchemy · Alembic · NumPy · pandas · SciPy (SLSQP) |
| **Market data** | yfinance (primary) + Alpha Vantage (fallback) with in-memory TTL cache |
| **Database** | PostgreSQL 15 |
| **Authentication** | JWT + bcrypt (OAuth2PasswordBearer) |
| **Infrastructure** | Docker Compose · Alembic migrations |

📄 **Full REST API reference:** [`API.md`](API.md) · Interactive docs (Swagger) at `/docs`.

---

## 🗂️ Project structure

```
tfg-optimizacion-carteras/
├── backend/
│   ├── alembic/                    # DB migrations
│   ├── app/
│   │   ├── api/                    # FastAPI routers (auth, assets, portfolio, backtesting)
│   │   ├── core/                   # Config + JWT + bcrypt
│   │   ├── db/                     # SQLAlchemy models + session
│   │   └── schemas/                # Pydantic
│   ├── optimizer/
│   │   ├── markowitz.py            # 5 optimization methods + frontier + Pareto
│   │   └── montecarlo.py           # Historical bootstrap + percentiles + histogram
│   ├── backtesting/
│   │   └── engine.py               # Backtest with rebalancing + commissions + crisis analysis
│   ├── etl/
│   │   ├── market_data.py          # yfinance + Alpha Vantage fallback connector
│   │   └── cache.py                # Thread-safe TTL cache with per-key single-flight lock
│   └── tests/                      # 68 unit tests (auth, portfolio, optimizer, cache)
└── frontend/src/
    ├── pages/
    │   ├── PlannerPage.tsx         # Financial planner
    │   ├── OptimizerPage.tsx       # Optimizer (5 methods + templates)
    │   ├── XRayPage.tsx            # Portfolio analysis
    │   ├── BacktestPage.tsx        # Historical backtest
    │   ├── ProjectionPage.tsx      # Monte Carlo
    │   ├── ComparePage.tsx         # Portfolio comparator
    │   ├── ProfilePage.tsx         # Account + profile summary
    │   └── LoginPage.tsx
    ├── components/                 # TickerSearch, EditPortfolioModal, PortfolioHistoryModal…
    ├── services/
    │   ├── api.ts                  # Axios client + shared types
    │   └── planner.ts              # Pure planner logic (rule of 110)
    └── portfolioTemplates.ts       # 13 portfolio templates
```

---

## ⚡ Quick start (recommended: Docker)

### Requirements
- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux).
- For non-Docker development: Python 3.11+ and Node 18+.

### Run with Docker Compose

```bash
git clone <repo-url>
cd tfg-optimizacion-carteras
cp .env.example .env       # create your .env and fill in the secrets (see next section)
docker compose up -d
```

Services:
- **Frontend** → http://localhost:5173
- **Backend** (API + Swagger) → http://localhost:8000/docs
- **PostgreSQL** → port 5432 (internal)

The first run builds the images (~3-5 min). Alembic migrations are applied automatically when the backend starts.

### Environment variables

Create `.env` in the root from `.env.example`. Key variables:

```
POSTGRES_USER=your_user
POSTGRES_PASSWORD=<choose-a-password>
POSTGRES_DB=tfg_carteras
DATABASE_URL=postgresql://your_user:<password>@db:5432/tfg_carteras

SECRET_KEY=<generate-a-random-64-char-string>
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALPHA_VANTAGE_API_KEY=<free-key-at-alphavantage.co>
```

> ⚠️ **Never commit the real `.env`.** `.gitignore` already excludes it. Use your own credentials, different from the development ones.

### Non-Docker setup (local development)

```bash
# Backend
cd backend
python -m venv venv
venv/Scripts/activate         # Windows  ·  source venv/bin/activate on Linux/Mac
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

---

## 🧪 Tests

```bash
# Backend (68 tests: auth, portfolio CRUD, security, Markowitz, Risk Parity, concurrent cache)
cd backend
pytest -q

# Frontend (strict TypeScript compilation)
cd frontend
npm run build
```

---

## 🔬 Notable engineering decisions

### Optimization
- **SLSQP with multi-start** (1 equal-weight point + 5-20 random Dirichlet points with a fixed seed) to avoid local minima.
- **Fallback** to global minimum variance if no iteration converges under the volatility constraint.

### Market data and concurrency
- **`auto_adjust=True`** in yfinance → returned prices are **total return** (split- and dividend-adjusted), validated against public sources.
- **In-memory TTL cache** (6 h prices, 1 h info, 15 min search) with metrics observable via `/assets/cache-stats`.
- **Per-key single-flight lock** to prevent the *cache stampede*: when N concurrent requests ask for the same asset with a cold cache, only one hits the external API; the others wait and read the already-cached result. Verified with a 10-thread concurrency test that confirms a single real download.
- **Historical bootstrap** (not MVN) for Monte Carlo: preserves the fat tails, skew, and partial autocorrelations present in real data, with a log-space correction of the drift bias.

### Financial model
- **Rule of 110** modulated by profile (±10pp) and horizon (capped by term) for the recommended asset allocation.
- **CVaR** computed directly on the empirical distribution (no normality assumption).
- **Simulated rebalancing**: real turnover (½ Σ |w − target|) × 2 (buy + sell) × commission, applied as a day-by-day haircut.

---

## 📚 References

- Markowitz, H. (1952). *Portfolio Selection*. Journal of Finance.
- DeMiguel, V., Garlappi, L., Uppal, R. (2009). *Optimal Versus Naive Diversification: How Inefficient is the 1/N Portfolio Strategy?*
- Maillard, S., Roncalli, T., Teïletche, J. (2010). *The Properties of Equally Weighted Risk Contribution Portfolios*.
- Choueifaty, Y., Coignard, Y. (2008). *Toward Maximum Diversification*.
- Rockafellar, R. T., Uryasev, S. (2000). *Optimization of Conditional Value-at-Risk*.
- Browne, H. (1981). *Permanent Portfolio*.
- Dalio, R. — Bridgewater Associates. *All Weather Strategy*.

---

## 👤 Author

**Rubén Moreno Fernández**
BSc in Computer Engineering — Information Systems track
University of Málaga, 2026

<!-- Add your links for recruiters:
[LinkedIn](https://linkedin.com/in/your-profile) · [GitHub](https://github.com/your-username)
-->

---

## 📄 License and disclaimer

Bachelor's Thesis (TFG) — University of Málaga, 2026. **Academic use.**

This software is provided "as is", without warranty of any kind. It is an educational project and **must not be used as a basis for real investment decisions**. It does not constitute financial, tax, or legal advice. The tax module is a didactic simplification of the Spanish IRPF and is no substitute for professional advice. Market data comes from external providers (Yahoo Finance, Alpha Vantage) and may contain errors, delays, or inaccuracies. The author disclaims all liability for third-party use of this tool.
