import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList,
} from 'recharts';
import {
  getProfile, runFiscalidad, FiscalidadResult,
} from '../services/api';
import { CARD, INPUT, LABEL } from '../styles';

function eur(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }); }
function pct(n: number) { return `${n.toFixed(2)} %`; }

export default function FiscalidadPage() {
  const [capital,    setCapital]    = useState<string>('10000');
  const [años,       setAños]       = useState<number>(20);
  const [retorno,    setRetorno]    = useState<string>('8');
  const [yieldStr,   setYieldStr]   = useState<string>('2.5');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState<FiscalidadResult | null>(null);

  useEffect(() => {
    getProfile()
      .then(({ data }) => {
        if (data.capital_base) setCapital(String(data.capital_base));
      })
      .catch(() => {});
  }, []);

  async function handleSimulate() {
    setError(''); setResult(null); setLoading(true);
    try {
      const cap   = parseFloat(capital.replace(',', '.'));
      const ret   = parseFloat(retorno.replace(',', '.')) / 100;
      const yld   = parseFloat(yieldStr.replace(',', '.')) / 100;
      if (isNaN(cap) || cap <= 0) throw new Error('Capital inválido.');
      const { data } = await runFiscalidad(cap, años, ret, yld);
      setResult(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err.message;
      setError(typeof detail === 'string' ? detail : 'Error al ejecutar la simulación.');
    } finally {
      setLoading(false);
    }
  }

  // Datos para el gráfico de barras: bruto teórico, ETF, Fondo
  const chartData = result ? [
    { categoria: 'Bruto teórico',     valor: result.bruto_teorico,                color: 'var(--text-3)' },
    { categoria: 'ETF distributivo',  valor: result.etf_distrib.valor_final_neto, color: 'var(--amber)' },
    { categoria: 'Fondo / acumul.',   valor: result.fondo_acum.valor_final_neto,  color: 'var(--green)' },
  ] : [];

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
          Análisis fiscal · IRPF español
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Compara el impacto del IRPF de la base del ahorro entre un <strong>ETF distributivo</strong>
          {' '}(paga dividendos cada año con retención del 19 %) y un <strong>Fondo de Inversión / ETF acumulativo</strong>
          {' '}(diferimiento total — solo tributas al rescatar). El típico golazo del Fondo a largo plazo.
        </p>
      </div>

      {/* Inputs */}
      <div style={{ ...CARD, marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr) 1.4fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={LABEL}>Capital inicial (€)</label>
            <input
              type="number" min={500} step={500}
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>CAGR esperado (%)</label>
            <input
              type="number" min={0} max={50} step={0.1}
              value={retorno}
              onChange={(e) => setRetorno(e.target.value)}
              style={INPUT}
            />
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>
              Total return anualizado (precio + dividendos)
            </div>
          </div>
          <div>
            <label style={LABEL}>Yield de dividendos (%)</label>
            <input
              type="number" min={0} max={20} step={0.1}
              value={yieldStr}
              onChange={(e) => setYieldStr(e.target.value)}
              style={INPUT}
            />
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>
              Solo afecta al ETF distributivo · S&P 500 ≈ 1.4 % · Dividend stocks ≈ 3-4 %
            </div>
          </div>
        </div>

        <div>
          <label style={LABEL}>Horizonte: <strong style={{ color: 'var(--text)' }}>{años} años</strong></label>
          <input
            type="range" min={1} max={40} step={1}
            value={años}
            onChange={(e) => setAños(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
            <span>1 año</span><span>40 años</span>
          </div>
        </div>

        {error && (
          <div style={{
            color: 'var(--red)', fontSize: '13px', marginTop: '12px',
            padding: '9px 12px', backgroundColor: 'rgba(232,64,64,0.08)',
            border: '1px solid rgba(232,64,64,0.3)', borderRadius: '6px',
          }}>{error}</div>
        )}

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          style={{
            marginTop: '14px',
            padding: '10px 24px',
            backgroundColor: loading ? 'var(--raised)' : 'var(--accent)',
            color: loading ? 'var(--text-3)' : '#fff',
            border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Calculando…' : '→ Calcular impacto fiscal'}
        </button>
      </div>

      {/* Resultados */}
      {result && (
        <>
          {/* Resumen comparativo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            {/* ETF */}
            <div style={{ ...CARD, borderLeft: '3px solid var(--amber)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <div style={{ color: 'var(--amber)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ETF distributivo
                </div>
                <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>SPY · BND · KO …</span>
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '4px' }}>Valor final neto IRPF</div>
              <div style={{ color: 'var(--amber)', fontSize: '32px', fontWeight: 700, lineHeight: 1, marginBottom: '12px' }}>
                {eur(result.etf_distrib.valor_final_neto)} €
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-2)' }}>
                <div>Bruto al cierre: <strong style={{ color: 'var(--text)' }}>{eur(result.etf_distrib.valor_final_bruto)} €</strong></div>
                <div>Plusvalía: <strong style={{ color: 'var(--text)' }}>{eur(result.etf_distrib.plusvalia)} €</strong></div>
                <div>IRPF plusvalía al rescate: <strong style={{ color: 'var(--red)' }}>−{eur(result.etf_distrib.irpf_plusvalia.total)} €</strong></div>
                <div>Retenciones anuales 19 % sobre dividendos: <strong style={{ color: 'var(--red)' }}>−{eur(result.etf_distrib.retenciones_anuales ?? 0)} €</strong></div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
                  IRPF total pagado: <strong style={{ color: 'var(--red)' }}>{eur(result.etf_distrib.irpf_total)} €</strong>
                </div>
              </div>
            </div>

            {/* Fondo */}
            <div style={{ ...CARD, borderLeft: '3px solid var(--green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <div style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Fondo / ETF acumulativo
                </div>
                <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>UCITS · diferimiento</span>
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '4px' }}>Valor final neto IRPF</div>
              <div style={{ color: 'var(--green)', fontSize: '32px', fontWeight: 700, lineHeight: 1, marginBottom: '12px' }}>
                {eur(result.fondo_acum.valor_final_neto)} €
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-2)' }}>
                <div>Bruto al cierre: <strong style={{ color: 'var(--text)' }}>{eur(result.fondo_acum.valor_final_bruto)} €</strong></div>
                <div>Plusvalía: <strong style={{ color: 'var(--text)' }}>{eur(result.fondo_acum.plusvalia)} €</strong></div>
                <div>IRPF al rescatar: <strong style={{ color: 'var(--red)' }}>−{eur(result.fondo_acum.irpf_plusvalia.total)} €</strong></div>
                <div>Retenciones anuales: <strong style={{ color: 'var(--green)' }}>0 € (diferimiento)</strong></div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
                  IRPF total pagado: <strong style={{ color: 'var(--red)' }}>{eur(result.fondo_acum.irpf_total)} €</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Diferimiento — el "golazo" */}
          <div style={{
            ...CARD, marginBottom: '20px',
            backgroundColor: 'rgba(14, 168, 117, 0.08)',
            border: '1px solid rgba(14, 168, 117, 0.35)',
            borderLeft: '3px solid var(--green)',
          }}>
            <div style={{ color: 'var(--green)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Ventaja del diferimiento fiscal español
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--green)', fontSize: '34px', fontWeight: 700 }}>
                +{eur(result.diferimiento.ahorro_eur)} €
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '14px' }}>
                ({pct(result.diferimiento.ahorro_pct)} más que el ETF distributivo)
              </div>
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: '8px', lineHeight: 1.6 }}>
              El Fondo de Inversión / ETF acumulativo no paga retención sobre los dividendos durante el horizonte:
              todo el rendimiento se reinvierte y compone más capital. Solo tributas plusvalías al rescatar.
              A más años y más yield, mayor el ahorro.
            </div>
          </div>

          {/* Gráfico comparativo */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Comparativa visual · valor final
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 12px' }}>
              Capital de {eur(result.parametros.capital)} € a {result.parametros.años} años con CAGR {pct(result.parametros.retorno_anualizado)}.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="categoria" stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
                <YAxis
                  stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }} width={70}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)} K€` : `${v.toFixed(0)} €`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: any) => [`${eur(v)} €`, 'Valor final']}
                />
                <Bar dataKey="valor">
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => `${eur(v)} €`}
                    style={{ fill: 'var(--text)', fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Desglose IRPF por tramos */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Desglose del IRPF de la plusvalía · base del ahorro
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 14px' }}>
              IRPF aplicado al rescatar la cartera, por tramos de la base imponible del ahorro (vigentes 2025).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {[
                { titulo: 'ETF distributivo', data: result.etf_distrib.irpf_plusvalia, color: 'var(--amber)' },
                { titulo: 'Fondo / acumulativo', data: result.fondo_acum.irpf_plusvalia, color: 'var(--green)' },
              ].map(({ titulo, data, color }) => (
                <div key={titulo}>
                  <div style={{ color, fontSize: '12px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {titulo}
                  </div>
                  {data.desglose.length === 0 ? (
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', fontStyle: 'italic' }}>Sin plusvalía gravable.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {['Tramo', 'Tipo', 'Base', 'Cuota'].map((h) => (
                            <th key={h} style={{ color: 'var(--text-2)', textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--border)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.desglose.map((tr, i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                              {eur(tr.desde)} – {tr.hasta >= 1e9 ? '∞' : eur(tr.hasta)}
                            </td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color }}>{(tr.tipo * 100).toFixed(0)} %</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'monospace' }}>{eur(tr.base)} €</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--red)', fontFamily: 'monospace', fontWeight: 600 }}>{eur(tr.cuota)} €</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} style={{ padding: '6px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600 }}>Total · tipo efectivo {(data.tipo_efectivo * 100).toFixed(2)} %</td>
                          <td style={{ padding: '6px', color, fontWeight: 700, fontFamily: 'monospace' }}>{eur(data.total)} €</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
            {/* Tabla de tramos vigentes */}
            <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'var(--raised)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Tramos IRPF base del ahorro (vigentes 2025):</strong><br />
              0–6 000 € → 19 % &nbsp;·&nbsp; 6 000–50 000 € → 21 % &nbsp;·&nbsp; 50 000–200 000 € → 23 % &nbsp;·&nbsp;
              200 000–300 000 € → 27 % &nbsp;·&nbsp; {'>'} 300 000 € → 28 %
            </div>
          </div>

          {/* Disclaimer académico */}
          <div style={{
            ...CARD, padding: '14px 18px',
            backgroundColor: 'rgba(232, 166, 64, 0.06)',
            border: '1px solid rgba(232, 166, 64, 0.25)',
            fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--amber)' }}>Aviso académico:</strong>{' '}
            simulación didáctica simplificada. <strong>No constituye asesoramiento fiscal.</strong>
            {' '}No contempla compensación de pérdidas patrimoniales con rendimientos del capital mobiliario,
            la regla de los 2 meses para recompras, casos transfronterizos, fiscalidad foral
            (País Vasco / Navarra), pagos a cuenta ni la doctrina más reciente.
            La retención del 19 % sobre dividendos se trata como tipo final cuando la base anual
            no supera los 6 000 €. Consulta a un asesor fiscal para tu caso particular.
          </div>
        </>
      )}
    </div>
  );
}
