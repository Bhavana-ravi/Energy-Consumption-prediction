import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bolt,
  Check,
  CloudUpload,
  FileSpreadsheet,
  House,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  Waves,
} from 'lucide-react';
import { buildDashboard, parseConsumptionCsv, saveSeries } from './forecast.js';

const HISTORY_OPTIONS = [7, 30, 90];

function formatDay(value, compact = false) {
  return new Intl.DateTimeFormat('en', {
    month: compact ? 'short' : 'long',
    day: 'numeric',
    ...(compact ? {} : { weekday: 'short' }),
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value ?? 0);
}

function buildChartData(payload) {
  const rows = payload.history.map((point) => ({ ...point, predicted: null }));
  if (rows.length) rows[rows.length - 1].predicted = rows[rows.length - 1].actual;
  return [...rows, ...payload.forecast.map((point) => ({ ...point, actual: null, forecastLabel: payload.model }))];
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const amount = row.actual ?? row.predicted;
  return (
    <div className="chart-tooltip">
      <span>{formatDay(label)}</span>
      <strong>{formatNumber(amount, 2)} <small>kWh</small></strong>
      <em>{row.actual == null ? row.forecastLabel : 'Measured usage'}</em>
    </div>
  );
}

function Metric({ label, value, unit, note, accent, icon: Icon }) {
  return (
    <article className={`metric metric-${accent}`}>
      <div className="metric-top"><span>{label}</span><Icon size={17} strokeWidth={1.8} /></div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function UploadPanel({ onUploaded, source }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function sendFile(file) {
    if (!file) return;
    setMessage('');
    setError('');
    setUploading(true);
    try {
      const series = await parseConsumptionCsv(file);
      saveSeries(series);
      setMessage(`Loaded ${series.length} days of readings. Saved in this browser.`);
      await onUploaded();
    } catch (problem) {
      setError(problem.message || 'Could not read this CSV. Check its format and try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="data-page">
      <div className="page-heading">
        <div><span className="eyebrow">YOUR HOUSEHOLD</span><h2>Your readings</h2><p>Import daily usage to build a forecast from your data.</p></div>
        <span className={`source-chip ${source === 'uploaded' ? 'is-live' : ''}`}><span />{source === 'uploaded' ? 'Personal data active' : 'Sample profile active'}</span>
      </div>
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); sendFile(event.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => sendFile(event.target.files[0])} />
        <div className="drop-icon"><CloudUpload size={24} strokeWidth={1.7} /></div>
        <h3>Drop a CSV file here</h3>
        <p>or choose a file from your computer</p>
        <button className="button button-dark" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
          {uploading ? 'Reading file' : 'Choose CSV'}
        </button>
        {message && <div className="upload-result success"><Check size={16} />{message}</div>}
        {error && <div className="upload-result error">{error}</div>}
      </div>
      <div className="csv-example"><div><span className="eyebrow">CSV FORMAT</span><span className="csv-caption">Date and kWh columns · at least 12 days · extra columns ignored</span></div><pre><span>date</span>,<span>kwh</span>{'\n'}2025-03-01,8.42{'\n'}2025-03-02,7.91</pre></div>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState('overview');
  const [historyDays, setHistoryDays] = useState(30);
  const [horizon, setHorizon] = useState(14);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      setPayload(await buildDashboard(historyDays, horizon));
    } catch (problem) {
      setError(problem.message || 'Could not build the forecast. Refresh the page and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, [historyDays, horizon]);

  const chartData = useMemo(() => payload ? buildChartData(payload) : [], [payload]);
  const forecast = payload?.forecast ?? [];
  const nextWeek = forecast.slice(0, 7);
  const maxForecast = Math.max(...nextWeek.map((day) => day.predicted ?? 0), 1);
  const latest = payload?.history.at(-1)?.date;
  const trend = payload?.metrics.change_percent ?? 0;

  async function downloadReport() {
    setDownloading(true);
    try {
      const svg = document.querySelector('.chart-wrap svg');
      if (!svg) throw new Error('The chart is still loading. Try again in a moment.');
      const copy = svg.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const objectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'energy-outlook.svg';
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setView('overview')} aria-label="Wattwise home">
          <span className="brand-mark"><Bolt size={19} fill="currentColor" /></span><span>wattwise<span className="brand-period">.</span></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')} title="Overview"><House size={17} />Overview<span className="nav-indicator" /></button>
          <button className={view === 'data' ? 'active' : ''} onClick={() => setView('data')} title="Your data"><FileSpreadsheet size={17} />Your data</button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-right"><span className={`source-chip ${payload?.source === 'uploaded' ? 'is-live' : ''}`}><span />{payload?.source === 'uploaded' ? 'Your data' : 'Sample data'}</span><span className="today-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div>
        </header>

        {view === 'data' ? <UploadPanel source={payload?.source} onUploaded={loadDashboard} /> : (
          <div className="dashboard">
            <section className="welcome-row">
              <div><span className="eyebrow">HOUSEHOLD ENERGY</span><h1>Energy outlook<span className="heading-period">.</span></h1><p className="welcome-copy">Recent usage and a short-term electricity forecast.</p></div>
              <div className="welcome-actions"><button className="button button-light" onClick={() => setView('data')}><Upload size={15} />Add your data</button><button className="button button-dark" onClick={downloadReport} disabled={downloading || loading}><ArrowDownToLine size={16} />{downloading ? 'Preparing' : 'Export chart'}</button></div>
            </section>

            {error && <div className="error-banner"><span>{error}</span><button onClick={loadDashboard}><RefreshCw size={15} />Retry</button></div>}

            <section className="metrics-grid" aria-label="Energy summary">
              <Metric label="DAILY AVERAGE" value={payload ? formatNumber(payload.metrics.average) : '—'} unit="kWh" note="Last 30 days" accent="green" icon={Waves} />
              <Metric label="LAST 30 DAYS" value={payload ? formatNumber(payload.metrics.total_month, 0) : '—'} unit="kWh" note="Total household use" accent="yellow" icon={Bolt} />
              <Metric label="NEXT 7 DAYS" value={payload ? formatNumber(payload.metrics.next_week) : '—'} unit="kWh / day" note="Forecast daily average" accent="coral" icon={ArrowUpRight} />
              <Metric label="VS LAST WEEK" value={payload ? `${trend > 0 ? '+' : ''}${formatNumber(trend)}%` : '—'} unit="" note="Expected usage change" accent="blue" icon={trend > 0 ? TrendingUp : TrendingDown} />
            </section>

            <section className="analysis-grid">
              <article className="chart-panel">
                <div className="panel-heading">
                  <div><span className="eyebrow">CONSUMPTION PATTERN</span><h2>Measured &amp; forecast</h2></div>
                  <div className="range-switch" aria-label="History window">
                    {HISTORY_OPTIONS.map((days) => <button key={days} className={historyDays === days ? 'selected' : ''} onClick={() => setHistoryDays(days)}>{days}D</button>)}
                  </div>
                </div>
                <div className="chart-meta"><div className="chart-legend"><span><i className="legend-actual" />Actual</span><span><i className="legend-forecast" />Forecast</span></div><label className="horizon-select">OUTLOOK <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option></select></label></div>
                <div className="chart-wrap">
                  {loading && !payload ? <div className="chart-loading"><LoaderCircle className="spin" size={22} />Building forecast</div> : <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: -17, bottom: 2 }}>
                      <defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#29765f" stopOpacity={0.17} /><stop offset="100%" stopColor="#29765f" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="#e8e9e2" strokeDasharray="3 5" />
                      <XAxis dataKey="date" tickFormatter={(day) => formatDay(day, true)} tickLine={false} axisLine={false} tick={{ fill: '#899088', fontSize: 11 }} minTickGap={34} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#899088', fontSize: 11 }} tickFormatter={(value) => `${value}`} width={38} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#c9cec5', strokeDasharray: '3 4' }} />
                      <Area type="monotone" dataKey="actual" stroke="#26755e" strokeWidth={2.5} fill="url(#actualFill)" connectNulls={false} activeDot={{ r: 4, fill: '#26755e', stroke: '#fff', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="predicted" stroke="#ed7659" strokeWidth={2.5} strokeDasharray="5 5" dot={false} connectNulls activeDot={{ r: 4, fill: '#ed7659', stroke: '#fff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>}
                </div>
                <div className="chart-footer"><span><span className="tiny-dot" />Daily electricity use in kWh</span><span>{latest ? `Updated through ${formatDay(latest)}` : 'Waiting for data'}</span></div>
              </article>

              <aside className="outlook-panel">
                <div className="outlook-heading"><div><span className="eyebrow">THE NEAR FUTURE</span><h2>Next 7 days</h2></div><span className="outlook-spark"><Sparkles size={16} /></span></div>
                <p className="outlook-summary">{trend <= 0 ? 'A little lighter than last week.' : 'A little higher than last week.'} Here’s the expected daily rhythm.</p>
                <div className="forecast-list">
                  {nextWeek.map((day, index) => <div className="forecast-row" key={day.date}><span className="forecast-day">{index === 0 ? 'Tomorrow' : formatDay(day.date, true)}</span><div className="forecast-track"><i style={{ width: `${Math.max(5, (day.predicted / maxForecast) * 100)}%` }} /></div><strong>{formatNumber(day.predicted)}<small>kWh</small></strong></div>)}
                </div>
                <div className="model-note"><span className="model-mark"><Waves size={15} /></span><div><strong>{payload?.model ?? 'ARIMA(2, 1, 2)'}</strong><small>{payload?.model_status === 'fallback' ? 'ARIMA unavailable' : 'Time-series model'}</small></div><span className="model-status">{payload?.model_status === 'fallback' ? 'BASELINE' : 'ACTIVE'}</span></div>
              </aside>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
