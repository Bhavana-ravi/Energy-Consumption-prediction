import Papa from 'papaparse';

const STORAGE_KEY = 'wattwise.daily-readings.v1';
let arimaModule;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function sampleSeries() {
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Array.from({ length: 210 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (209 - index));
    const weekly = 1.4 * Math.sin((index % 7) / 7 * 2 * Math.PI - 1.2);
    const annual = 2.1 * Math.sin(index / 70 * 2 * Math.PI);
    const trend = index * 0.012;
    const noise = 0.55 * Math.sin(index * 2.31) + 0.3 * Math.cos(index * 0.73);
    return { date: dateKey(date), kwh: Math.max(7.8 + weekly + annual + trend + noise, 2.5) };
  });
}

export function readSeries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length >= 12) return saved;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function saveSeries(series) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
}

function parseDate(value) {
  const parsed = new Date(String(value ?? '').trim());
  return Number.isNaN(parsed.valueOf()) ? null : dateKey(parsed);
}

export function parseConsumptionCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data, meta }) => {
        const columns = meta.fields ?? [];
        const normalized = (column) => column.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const dateNames = new Set(['date', 'datetime', 'timestamp', 'time']);
        const valueNames = new Set(['kwh', 'energy', 'consumption', 'usage', 'value', 'reading']);
        const dateColumn = columns.find((column) => dateNames.has(normalized(column)));
        const valueColumn = columns.find((column) => valueNames.has(normalized(column)) || /kwh|energy|consumption|usage|reading/.test(normalized(column)));
        if (!dateColumn || !valueColumn) {
          reject(new Error('CSV needs a date/timestamp column and a kWh/consumption/value column.'));
          return;
        }

        const totals = new Map();
        for (const row of data) {
          const day = parseDate(row[dateColumn]);
          const rawValue = String(row[valueColumn] ?? '').replace(/,/g, '').trim();
          const value = Number(rawValue);
          if (day && rawValue !== '' && Number.isFinite(value)) totals.set(day, (totals.get(day) ?? 0) + value);
        }
        const days = [...totals.keys()].sort();
        if (days.length < 12) {
          reject(new Error('Add at least 12 days of readings to fit an ARIMA forecast.'));
          return;
        }

        const start = new Date(`${days[0]}T00:00:00Z`);
        const end = new Date(`${days.at(-1)}T00:00:00Z`);
        const series = [];
        for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          const day = dateKey(cursor);
          if (totals.has(day)) {
            series.push({ date: day, kwh: totals.get(day) });
          } else {
            const before = series.at(-1)?.kwh;
            const afterDay = new Date(cursor);
            while (afterDay <= end && !totals.has(dateKey(afterDay))) afterDay.setUTCDate(afterDay.getUTCDate() + 1);
            const after = totals.get(dateKey(afterDay));
            series.push({ date: day, kwh: before + (after - before) / (Math.round((afterDay - cursor) / 86400000) + 1) });
          }
        }
        resolve(series);
      },
      error: reject,
    });
  });
}

async function getArima() {
  if (!arimaModule) {
    arimaModule = import('arima/async').then(async (module) => await (module.default ?? module));
  }
  return arimaModule;
}

export async function buildDashboard(historyDays, horizon) {
  const saved = readSeries();
  const series = saved ?? sampleSeries();
  const ARIMA = await getArima();
  const model = new ARIMA({ p: 2, d: 1, q: 2, verbose: false }).train(series.map((point) => point.kwh));
  let values;
  try {
    [values] = model.predict(horizon);
  } finally {
    model.destroy();
  }

  const forecast = Array.from(values, (value, index) => {
    const date = new Date(`${series.at(-1).date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index + 1);
    return { date: dateKey(date), predicted: Math.max(0.01, Number(value)) };
  });
  const previousWeekValues = series.slice(-14, -7);
  const previousWeek = previousWeekValues.reduce((total, point) => total + point.kwh, 0) / Math.max(1, previousWeekValues.length);
  const nextWeek = forecast.slice(0, 7).reduce((total, point) => total + point.predicted, 0) / Math.min(7, horizon);
  const history = series.slice(-historyDays).map((point) => ({ date: point.date, actual: Number(point.kwh.toFixed(2)) }));
  return {
    history,
    forecast: forecast.map((point) => ({ ...point, predicted: Number(point.predicted.toFixed(2)) })),
    metrics: {
      average: Number((series.slice(-30).reduce((total, point) => total + point.kwh, 0) / Math.min(30, series.length)).toFixed(2)),
      next_week: Number(nextWeek.toFixed(2)),
      change_percent: Number((previousWeek ? (nextWeek - previousWeek) / previousWeek * 100 : 0).toFixed(1)),
      peak: Number(Math.max(...series.map((point) => point.kwh)).toFixed(2)),
      total_month: Number(series.slice(-30).reduce((total, point) => total + point.kwh, 0).toFixed(1)),
    },
    source: saved ? 'uploaded' : 'sample',
    model: 'ARIMA(2, 1, 2)',
    updated: new Date().toISOString().slice(0, 16),
  };
}
