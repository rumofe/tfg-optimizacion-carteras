# API — PortfolioLab

Referencia de la API REST del backend (FastAPI). Base URL en desarrollo: `http://127.0.0.1:8000`. Documentación interactiva (Swagger) en `/docs`.

## Autenticación

La API usa JWT (OAuth2 password flow, bcrypt para el hash de contraseñas).

1. Registro o login devuelven un `access_token`.
2. En los endpoints protegidos, envía la cabecera `Authorization: Bearer <access_token>`.
3. El token expira a los `ACCESS_TOKEN_EXPIRE_MINUTES` (30 min por defecto, configurable en `.env`).

Un token inválido o ausente devuelve `401 Unauthorized`.

---

## `POST /auth/register`

Crea una cuenta de usuario.

**Body**
```json
{ "email": "user@example.com", "password": "..." }
```

**201** → `{ "access_token": "...", "token_type": "bearer" }`
**400** → email ya registrado.

## `POST /auth/login`

Login (OAuth2 password form: `username` = email, `password`).

**200** → `{ "access_token": "...", "token_type": "bearer" }`
**401** → credenciales incorrectas.

## `GET /auth/profile` 🔒

Devuelve el perfil del usuario autenticado (`email`, `capital_base`, `tolerancia_riesgo`).

## `PUT /auth/profile` 🔒

Actualiza `capital_base` y/o `tolerancia_riesgo` del usuario autenticado. Ambos campos son opcionales.

---

## `GET /assets/search?q=`

Busca tickers en Yahoo Finance por símbolo o nombre. Devuelve hasta 8 resultados (`ticker`, `nombre`, `tipo`, `exchange`). No requiere autenticación.

**502** si Yahoo Finance falla.

## `GET /assets/{ticker}/prices?period=`

Histórico de precios de un ticker. `period` acepta `1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max` (por defecto `1y`).

**200** → `{ "ticker", "period", "prices": [...] }`
**502** si falla la fuente de datos (yfinance / Alpha Vantage fallback).

## `GET /assets/{ticker}/info`

Metadatos del activo: sector, industria, país, market cap, categoría (Large/Mid/Small Cap), estilo de inversión (Value/Blend/Growth), clase de activo (Equity/Bonds/Real Estate/Commodities/Cash/Alternatives), yield y frecuencia de dividendos. Usado para el X-Ray sectorial.

Cacheado 1 h por ticker en memoria.

**404** si el ticker no existe. **502** si falla la fuente de datos.

## `GET /assets/cache-stats`

Métricas del caché en memoria (precios, info, búsqueda). Oculto de la documentación Swagger (`include_in_schema=False`), pensado para debug.

---

## `POST /portfolio/optimize` 🔒

Calcula la cartera óptima y la frontera eficiente de Markowitz completa.

**Body**
```json
{
  "tickers": ["AAPL", "BND"],
  "capital": 10000,
  "max_volatilidad": 0.15,
  "metodo": "markowitz",
  "peso_min": 0.0,
  "peso_max": 1.0
}
```
`metodo`: `markowitz | min_variance | risk_parity | equal_weight | min_cvar`.

**422** si hay menos de 2 tickers. **400** en error de validación del optimizador. **502** si falla la descarga de datos de mercado.

Protegido con JWT: es un endpoint de cómputo intensivo (SLSQP multi-start).

## `POST /portfolio/monte-carlo` 🔒

Simulación Monte Carlo (bootstrap histórico) de la trayectoria futura de la cartera.

**Body**
```json
{
  "tickers": ["AAPL", "BND"],
  "pesos": { "AAPL": 0.6, "BND": 0.4 },
  "años": 10,
  "n_simulaciones": 5000,
  "capital_inicial": 10000,
  "modo": "ajustado",
  "cagr_esperado": null
}
```
`modo`: `historico | ajustado | manual` (`cagr_esperado` solo aplica en `manual`).

**422** si falta algún ticker o los pesos no suman 1.0 (tolerancia ±0.01).

Devuelve percentiles temporales (5/25/50/75/95), CAGR mediano, distribución del valor final y probabilidades clave (pérdida, doblar, triplicar capital).

## `POST /portfolio/fiscalidad` 🔒

Compara el impacto fiscal español (IRPF base del ahorro) entre un ETF distributivo y uno acumulativo. Simplificación didáctica, no es asesoramiento fiscal real.

## `POST /portfolio/` 🔒

Guarda una cartera optimizada para el usuario autenticado.

**Body**: `nombre_estrategia`, `tickers`, `pesos`, `capital`.
**201** → `{ "id", "mensaje" }`.

## `GET /portfolio/` 🔒

Lista todas las carteras guardadas del usuario, con sus activos y pesos.

## `PUT /portfolio/{cartera_id}` 🔒

Actualiza nombre y pesos de una cartera existente. Antes de sobrescribir, guarda un snapshot del estado anterior (`motivo: "edicion"`). Sustituye todos los activos por los nuevos.

**404** si la cartera no pertenece al usuario o no existe. **422** si `pesos` está vacío.

## `GET /portfolio/{cartera_id}/snapshots` 🔒

Historial de versiones de una cartera (más reciente primero).

## `DELETE /portfolio/{cartera_id}` 🔒

Elimina una cartera y sus activos/snapshots asociados. **204** sin contenido.

---

## `POST /backtesting/run` 🔒

Backtest histórico con pesos fijos.

**Body**
```json
{
  "tickers": ["AAPL", "BND"],
  "pesos": { "AAPL": 0.6, "BND": 0.4 },
  "periodo": "5y",
  "fecha_inicio": null,
  "fecha_fin": null,
  "rebalanceo": "ninguno",
  "comision_pct": 0.0
}
```
`rebalanceo`: `ninguno | mensual | trimestral | semestral | anual`. `pesos` no puede tener valores negativos y debe sumar 1.0 (validado con Pydantic `field_validator`).

**200** → métricas globales (rentabilidad, volatilidad, Sharpe, Sortino, Calmar, Beta, Max Drawdown) + análisis por periodos de crisis (COVID 2020, Lehman 2008-09, corrección 2022).

**400/502** en error de validación o de fuente de datos.

---

## Notas generales

- Todos los endpoints marcados con 🔒 requieren `Authorization: Bearer <token>` y devuelven `401` si falta o es inválido.
- Los errores de fuente de datos externa (yfinance / Alpha Vantage) se traducen siempre a `502 Bad Gateway`.
- Los errores de validación de negocio (tickers insuficientes, pesos que no suman 1, etc.) se traducen a `400` o `422` según el caso.
- CORS está abierto a todos los orígenes (`allow_origins=["*"]`) — pensado para desarrollo/demo, revisar antes de exponer a producción.
