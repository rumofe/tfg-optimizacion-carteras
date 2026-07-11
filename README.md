<div align="center">

# 📊 PortfolioLab

### Plataforma web de análisis y optimización de carteras de inversión

Optimización moderna de carteras (Markowitz, Risk Parity, CVaR), planificación financiera estilo *robo-advisor* y análisis visual estilo Morningstar sobre datos reales de mercado.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-68%20passing-2DD4A7)
![License](https://img.shields.io/badge/licencia-uso%20acad%C3%A9mico-blue)

**Trabajo de Fin de Grado · Ingeniería Informática · Universidad de Málaga · 2026**

<!-- 🔗 Demo en vivo: https://TU-DEMO.vercel.app  (añádelo cuando despliegues) -->

</div>

---

> ### ⚠️ Aviso importante
> **PortfolioLab es un proyecto académico con fines exclusivamente educativos y de demostración técnica.** No constituye asesoramiento financiero, fiscal ni de inversión, ni una recomendación de compra o venta de ningún activo. Los cálculos se basan en datos históricos de terceros y en modelos simplificados; los resultados pasados no garantizan rendimientos futuros. El autor no se hace responsable de decisiones tomadas a partir de esta herramienta. Consulta siempre a un asesor financiero acreditado antes de invertir.

---

<!--
📸 CAPTURA "HERO" — pon aquí una imagen ancha del Optimizador o el X-Ray.
Guárdala en docs/screenshots/hero.png y descomenta la línea de abajo:
-->
<!-- ![PortfolioLab](docs/screenshots/hero.png) -->

## ✨ Funcionalidades

### 🎯 Optimizador con 5 métodos
| Método | Función objetivo | Cuándo usarlo |
|---|---|---|
| **Sharpe (Markowitz)** | Maximiza retorno/riesgo con restricción de volatilidad | Cartera "óptima" clásica |
| **Mínima varianza** | Minimiza la volatilidad global | Inversor muy conservador |
| **Risk Parity (ERC)** | Iguala la contribución al riesgo de cada activo | Diversificación efectiva (Maillard-Roncalli 2010) |
| **Mínimo CVaR** | Minimiza la pérdida media en el peor 5 % de días | Aversión a pérdidas de cola (Rockafellar-Uryasev 2000) |
| **Equal Weight (1/N)** | Pesos iguales, sin optimización | Baseline naive (DeMiguel et al. 2009) |

Sobre el resultado se calculan **6 métricas comparables**: Sharpe, Diversification Ratio (Choueifaty), HHI de concentración, activos efectivos (1/HHI), CVaR 95 % y yield ponderado de dividendos.

Visualizaciones: **frontera eficiente** de Markowitz (50 puntos) + **frontera de Pareto Sharpe-vs-Sortino** (escalarización θ).

### 📋 Planificador financiero (modo robo-advisor)
- Inputs: liquidez, gastos mensuales, edad, horizonte, perfil de riesgo, fondo de emergencia deseado.
- Outputs: capital invertible, asset allocation sugerida (cash/bonds/equity/RE/commodities) usando **regla del 110** modulada por perfil y horizonte.
- Botón "Aplicar al Optimizador" que pre-rellena capital y muestra la asignación recomendada.

### 📈 Backtesting histórico
- 8 métricas: rentabilidad acumulada, retorno anualizado, volatilidad, **Sharpe, Sortino, Calmar**, máximo drawdown, beta vs SPY.
- Periodos: YTD, 1y, 3y, 5y, 10y, 20y, max + **rango de fechas personalizado**.
- **Análisis de crisis**: COVID 2020, Lehman 2008-09, corrección 2022 — métricas separadas para cada periodo.
- **Rebalanceo periódico** (mensual / trimestral / semestral / anual) con simulación día a día.
- **Comisiones realistas** modeladas con turnover (broker low-cost ≈ 0.1 %, banca tradicional ≈ 0.5 %).
- **Descomposición precio vs dividendos**: muestra qué porcentaje del retorno viene de revalorización y cuánto de dividendos reinvertidos, con ingresos anuales en €.

### 🔬 X-Ray (análisis de cartera)
- **Distribución por clase de activo** (Equity / Bonds / Real Estate / Commodities / Cash / Alternatives) con barra apilada.
- **Sectores** (donut + barras).
- **Geografía**: mapa coroplético del mundo con tooltip por país.
- **Style Box Morningstar** 3×3 (Capitalización × Estilo Value/Blend/Growth).
- **Distribuciones** por capitalización (Large/Mid/Small) y estilo.
- **Tipo de activo** (Cíclico/Sensible/Defensivo) según clasificación Morningstar.
- **Análisis de dividendos**: yield ponderado, top contribuyentes, frecuencia de pago.
- **Historial de versiones** (snapshots): timeline con diffs entre ediciones de cada cartera.

### 🎲 Proyección Monte Carlo
- **Bootstrap histórico** (sortear con reemplazo retornos diarios reales) — preserva colas gordas y asimetría que la distribución normal borra.
- 1 000 / 5 000 / 10 000 simulaciones × hasta 30 años (vectorizado en NumPy: 5 000×10y en ~270 ms).
- Outputs: percentiles temporales 5/25/50/75/95, CAGR mediano + percentiles, distribución del valor final, **probabilidades clave** (pérdida, doblar, triplicar capital).
- Visualización: **fan chart** con bandas de incertidumbre 50 % y 90 %, histograma logarítmico del valor final.

### 🆚 Comparador
Hasta 4 carteras guardadas en paralelo: equity curves superpuestas (base 100), tabla de 8 métricas comparada, composición lado a lado.

### 📚 Catálogo de plantillas (13 carteras famosas)
- Conservadoras: 60/40 Global · Defensiva con dividendos · Bond Ladder · **Permanent Portfolio (Browne)** · Income Utilities & REITs.
- Moderadas: Core S&P + Internacional · Sectores balanceados · Blue Chips US · **All Weather (Ray Dalio)** · Income con bonos + dividendos.
- Agresivas: Mega-cap Tech · Disrupción · Semis + Emergentes.

Filtradas según el perfil del usuario detectado en el Planificador, con toggle "Ver todas".

### 🎨 UX
- 6 temas CSS intercambiables (Dark, Navy, Light, Rose, Esmeralda, Ámbar).
- Sidebar fijo lateral con 6 módulos: Planificador → Optimizador → X-Ray → Backtesting → Proyección → Comparador.
- Auth JWT con auto-logout en expiración.
- Edición in-place de pesos de carteras guardadas con normalización automática.

---

## 📸 Capturas

<!--
Añade capturas reales de la app aquí — es lo que más engancha a quien mira el repo.
Recomendadas (guárdalas en docs/screenshots/ y descomenta):

| Optimizador | X-Ray |
|:---:|:---:|
| ![Optimizador](docs/screenshots/optimizer.png) | ![X-Ray](docs/screenshots/xray.png) |

| Backtesting | Proyección Monte Carlo |
|:---:|:---:|
| ![Backtesting](docs/screenshots/backtest.png) | ![Monte Carlo](docs/screenshots/montecarlo.png) |
-->

> _Capturas pendientes de añadir en `docs/screenshots/`._

---

## 💻 Stack tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · React Router · Recharts · react-simple-maps · Axios |
| **Backend** | Python 3.11 · FastAPI · SQLAlchemy · Alembic · NumPy · pandas · SciPy (SLSQP) |
| **Datos de mercado** | yfinance (primario) + Alpha Vantage (fallback) con caché TTL en memoria |
| **Base de datos** | PostgreSQL 15 |
| **Autenticación** | JWT + bcrypt (OAuth2PasswordBearer) |
| **Infraestructura** | Docker Compose · migraciones Alembic |

📄 **Referencia completa de la API REST:** [`API.md`](API.md) · Documentación interactiva (Swagger) en `/docs`.

---

## 🗂️ Estructura del proyecto

```
tfg-optimizacion-carteras/
├── backend/
│   ├── alembic/                    # Migraciones de BD
│   ├── app/
│   │   ├── api/                    # Routers FastAPI (auth, assets, portfolio, backtesting)
│   │   ├── core/                   # Config + JWT + bcrypt
│   │   ├── db/                     # Modelos SQLAlchemy + sesión
│   │   └── schemas/                # Pydantic
│   ├── optimizer/
│   │   ├── markowitz.py            # 5 métodos de optimización + frontera + Pareto
│   │   └── montecarlo.py           # Bootstrap histórico + percentiles + histograma
│   ├── backtesting/
│   │   └── engine.py               # Backtest con rebalanceo + comisiones + análisis de crisis
│   ├── etl/
│   │   ├── market_data.py          # Conector yfinance + Alpha Vantage fallback
│   │   └── cache.py                # Caché TTL thread-safe con lock single-flight por clave
│   └── tests/                      # 68 tests unitarios (auth, portfolio, optimizer, caché)
└── frontend/src/
    ├── pages/
    │   ├── PlannerPage.tsx         # Planificador financiero
    │   ├── OptimizerPage.tsx       # Optimizador (5 métodos + plantillas)
    │   ├── XRayPage.tsx            # Análisis de cartera
    │   ├── BacktestPage.tsx        # Backtest histórico
    │   ├── ProjectionPage.tsx      # Monte Carlo
    │   ├── ComparePage.tsx         # Comparador de carteras
    │   ├── ProfilePage.tsx         # Cuenta + resumen del perfil
    │   └── LoginPage.tsx
    ├── components/                 # TickerSearch, EditPortfolioModal, PortfolioHistoryModal…
    ├── services/
    │   ├── api.ts                  # Cliente axios + tipos compartidos
    │   └── planner.ts              # Lógica pura del planificador (regla del 110)
    └── portfolioTemplates.ts       # 13 plantillas de cartera
```

---

## ⚡ Setup rápido (recomendado: Docker)

### Requisitos
- Docker Desktop (Windows/Mac) o Docker + Docker Compose (Linux).
- Para desarrollo sin Docker: Python 3.11+ y Node 18+.

### Arranque con Docker Compose

```bash
git clone <url-del-repo>
cd tfg-optimizacion-carteras
cp .env.example .env       # crea tu .env y rellena los secretos (ver siguiente sección)
docker compose up -d
```

Servicios:
- **Frontend** → http://localhost:5173
- **Backend** (API + Swagger) → http://localhost:8000/docs
- **PostgreSQL** → puerto 5432 (interno)

La primera vez Docker construirá las imágenes (~3-5 min). Las migraciones Alembic se aplican automáticamente al arrancar el backend.

### Variables de entorno

Crea `.env` en la raíz a partir de `.env.example`. Variables clave:

```
POSTGRES_USER=tu_usuario
POSTGRES_PASSWORD=<elige-una-password>
POSTGRES_DB=tfg_carteras
DATABASE_URL=postgresql://tu_usuario:<password>@db:5432/tfg_carteras

SECRET_KEY=<genera-una-aleatoria-de-64-chars>
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALPHA_VANTAGE_API_KEY=<tu-clave-gratis-en-alphavantage.co>
```

> ⚠️ **No commitear nunca el `.env` real.** El `.gitignore` ya lo excluye. Usa credenciales propias, distintas de las de desarrollo.

### Setup sin Docker (desarrollo local)

```bash
# Backend
cd backend
python -m venv venv
venv/Scripts/activate         # Windows  ·  source venv/bin/activate en Linux/Mac
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

---

## 🧪 Tests

```bash
# Backend (68 tests: auth, portfolio CRUD, seguridad, Markowitz, Risk Parity, caché concurrente)
cd backend
pytest -q

# Frontend (compilación TypeScript estricta)
cd frontend
npm run build
```

---

## 🔬 Decisiones técnicas relevantes

### Optimización
- **SLSQP con multi-start** (1 punto equiponderado + 5-20 puntos Dirichlet aleatorios con semilla fija) para evitar mínimos locales.
- **Fallback** a mínima varianza global si ninguna iteración converge bajo la restricción de volatilidad.

### Datos de mercado y concurrencia
- **`auto_adjust=True`** en yfinance → los precios devueltos son **total return** (split + dividend adjusted), validado contra fuentes públicas.
- **Caché TTL** en memoria (6 h precios, 1 h info, 15 min búsqueda) con métricas observables vía `/assets/cache-stats`.
- **Lock single-flight por clave** para evitar el *cache stampede*: cuando N peticiones concurrentes piden el mismo activo con la caché fría, solo una descarga de la API externa; las demás esperan y leen el resultado ya cacheado. Verificado con un test de 10 hilos concurrentes que confirma una única descarga real.
- **Bootstrap histórico** (no MVN) para Monte Carlo: preserva colas gordas, asimetría y autocorrelaciones parciales presentes en los datos reales, con corrección del sesgo del *drift* en espacio logarítmico.

### Modelo financiero
- **Regla del 110** modulada por perfil (±10pp) y horizonte (cap por plazo) para asset allocation recomendada.
- **CVaR** calculado directamente sobre la distribución empírica (no asume normalidad).
- **Rebalanceo simulado**: turnover real (½ Σ |w − target|) × 2 (compra + venta) × comisión, aplicado como haircut día a día.

---

## 📚 Referencias bibliográficas usadas

- Markowitz, H. (1952). *Portfolio Selection*. Journal of Finance.
- DeMiguel, V., Garlappi, L., Uppal, R. (2009). *Optimal Versus Naive Diversification: How Inefficient is the 1/N Portfolio Strategy?*
- Maillard, S., Roncalli, T., Teïletche, J. (2010). *The Properties of Equally Weighted Risk Contribution Portfolios*.
- Choueifaty, Y., Coignard, Y. (2008). *Toward Maximum Diversification*.
- Rockafellar, R. T., Uryasev, S. (2000). *Optimization of Conditional Value-at-Risk*.
- Browne, H. (1981). *Permanent Portfolio*.
- Dalio, R. — Bridgewater Associates. *All Weather Strategy*.

---

## 👤 Autor

**Rubén Moreno Fernández**
Grado en Ingeniería Informática — Mención en Sistemas de Información
Universidad de Málaga, 2026

<!-- Añade tus enlaces para el CV:
[LinkedIn](https://linkedin.com/in/tu-perfil) · [GitHub](https://github.com/tu-usuario)
-->

---

## 📄 Licencia y descargo de responsabilidad

Trabajo Fin de Grado — Universidad de Málaga, 2026. **Uso académico.**

Este software se distribuye "tal cual", sin garantía de ningún tipo. Es un proyecto educativo y **no debe utilizarse como base para decisiones reales de inversión**. No constituye asesoramiento financiero, fiscal ni legal. El módulo de fiscalidad es una simplificación didáctica del IRPF español y no sustituye el asesoramiento de un profesional. Los datos de mercado proceden de proveedores externos (Yahoo Finance, Alpha Vantage) y pueden contener errores, retrasos o inexactitudes. El autor declina toda responsabilidad por el uso que terceros hagan de esta herramienta.
