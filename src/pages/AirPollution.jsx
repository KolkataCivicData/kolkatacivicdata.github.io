import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

// ── Data ────────────────────────────────────────────────────────
import data2024 from '../data/aqi/2024.json';

const DATA_BY_YEAR = { '2024': data2024 };

// ── Constants ────────────────────────────────────────────────────
const STATIONS = [
  'Victoria', 'Fort_William', 'Rabindra_Bharati',
  'Bidhannagar', 'Jadavpur', 'Rabindra_Sarobar', 'Ballygunge'
];
const LABELS = {
  Victoria: 'Victoria',
  Fort_William: 'Fort William',
  Rabindra_Bharati: 'R. Bharati',
  Bidhannagar: 'Bidhannagar',
  Jadavpur: 'Jadavpur',
  Rabindra_Sarobar: 'R. Sarobar',
  Ballygunge: 'Ballygunge',
};
const COLORS = {
  Victoria: '#3b82f6',
  Fort_William: '#f97316',
  Rabindra_Bharati: '#10b981',
  Bidhannagar: '#8b5cf6',
  Jadavpur: '#ef4444',
  Rabindra_Sarobar: '#06b6d4',
  Ballygunge: '#f59e0b',
};
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

// ── Helpers ──────────────────────────────────────────────────────
function mean(arr) {
  const v = arr.filter(x => x != null);
  return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : null;
}

function aqiColor(v) {
  if (v == null) return '#a3a3a3';
  if (v <= 50)  return '#22c55e';
  if (v <= 100) return '#eab308';
  if (v <= 150) return '#f97316';
  if (v <= 200) return '#ef4444';
  if (v <= 300) return '#a855f7';
  return '#7f1d1d';
}

function aqiClass(v) {
  if (v == null) return '';
  if (v <= 50)  return 'aqi-good';
  if (v <= 100) return 'aqi-moderate';
  if (v <= 150) return 'aqi-ufs';
  if (v <= 200) return 'aqi-unhealthy';
  if (v <= 300) return 'aqi-very';
  return 'aqi-hazardous';
}

function aqiLabel(v) {
  if (v == null) return 'N/A';
  if (v <= 50)  return 'Good';
  if (v <= 100) return 'Moderate';
  if (v <= 150) return 'Unhealthy for sensitive groups';
  if (v <= 200) return 'Unhealthy';
  if (v <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

// ── Custom tooltip ───────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background:'#fff', border:'1px solid #e5e5e5', borderRadius:8,
      padding:'10px 14px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{fontWeight:600, marginBottom:6, color:'#1a1a1a'}}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{display:'flex', alignItems:'center', gap:8, padding:'2px 0'}}>
          <span style={{width:10, height:10, borderRadius:3, background:p.color, flexShrink:0}}/>
          <span style={{color:'#737373'}}>{LABELS[p.dataKey] || p.dataKey}:</span>
          <span style={{fontWeight:600, color: aqiColor(p.value)}}>{p.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
const AirPollution = () => {
  const [activeYear, setActiveYear] = useState('2024');
  const [activeStation, setActiveStation] = useState('all');

  const data = DATA_BY_YEAR[activeYear] || [];

  // Compute monthly aggregates
  const monthlyData = useMemo(() => {
    return MONTHS_FULL.map((month, mi) => {
      const rows = data.filter(r => r.monthIndex === mi);
      const entry = { month, short: MONTHS_SHORT[mi] };
      STATIONS.forEach(s => { entry[s] = mean(rows.map(r => r[s])); });
      const all = STATIONS.flatMap(s => rows.map(r => r[s])).filter(v => v != null);
      entry.overall = all.length ? Math.round(all.reduce((a,b)=>a+b,0)/all.length) : null;
      return entry;
    });
  }, [data]);

  // Year-wide stats
  const allVals = useMemo(() =>
    data.flatMap(r => STATIONS.map(s => r[s])).filter(v => v != null),
    [data]
  );
  const yearAvg = allVals.length ? Math.round(allVals.reduce((a,b)=>a+b,0)/allVals.length) : 0;
  const yearMax = allVals.length ? Math.max(...allVals) : 0;
  const yearMin = allVals.length ? Math.min(...allVals) : 0;

  // Station annual averages for bar chart
  const stationBars = useMemo(() =>
    STATIONS.map(s => ({
      s, label: LABELS[s],
      avg: mean(data.map(r => r[s]))
    })).sort((a,b) => (b.avg||0)-(a.avg||0)),
    [data]
  );

  // Which stations to show in charts
  const visibleStations = activeStation === 'all' ? STATIONS : [activeStation];

  if (!data.length) {
    return (
      <div>
        <h1 className="page-title">Air Pollution — Kolkata</h1>
        <p className="page-sub">Data for {activeYear} is not yet available.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Air Pollution — Kolkata {activeYear}</h1>
          <p className="page-sub">Daily PM2.5 AQI across 7 monitoring stations</p>
        </div>
        <div className="year-tabs">
          {['2024', '2025'].map(y => (
            <button
              key={y}
              className={`year-tab${activeYear === y ? ' active' : ''}`}
              onClick={() => setActiveYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Annual average AQI</div>
          <div className="stat-value" style={{color: aqiColor(yearAvg)}}>{yearAvg}</div>
          <div className="stat-sub">{aqiLabel(yearAvg)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Worst single-day AQI</div>
          <div className="stat-value" style={{color: aqiColor(yearMax)}}>{yearMax}</div>
          <div className="stat-sub">Oct 31 · R. Bharati</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cleanest single-day AQI</div>
          <div className="stat-value" style={{color: aqiColor(yearMin)}}>{yearMin}</div>
          <div className="stat-sub">Aug–Sep monsoon period</div>
        </div>
      </div>

      {/* Station filter pills */}
      <div className="pills">
        <button
          className={`pill${activeStation === 'all' ? ' active' : ''}`}
          onClick={() => setActiveStation('all')}
        >
          All stations
        </button>
        {STATIONS.map(s => (
          <button
            key={s}
            className={`pill${activeStation === s ? ' active' : ''}`}
            style={activeStation === s ? {background: COLORS[s], borderColor: COLORS[s], color:'#fff'} : {}}
            onClick={() => setActiveStation(s)}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>

      {/* Monthly trend line chart */}
      <div className="chart-wrap">
        <div className="chart-title">Monthly AQI trend</div>
        <div className="legend">
          {visibleStations.map(s => (
            <div key={s} className="legend-item">
              <div className="legend-dot" style={{background: COLORS[s]}}/>
              {LABELS[s]}
            </div>
          ))}
          {activeStation === 'all' && (
            <div className="legend-item">
              <div className="legend-dash" style={{background:'#1a1a1a'}}/>
              Overall avg
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData} margin={{top:4, right:8, left:-20, bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="short" tick={{fontSize:11, fill:'#a3a3a3'}}/>
            <YAxis tick={{fontSize:11, fill:'#a3a3a3'}} domain={[0,'auto']}/>
            <Tooltip content={<ChartTooltip/>}/>
            {visibleStations.map(s => (
              <Line
                key={s} type="monotone" dataKey={s}
                stroke={COLORS[s]}
                strokeWidth={activeStation === 'all' ? 1.5 : 2.5}
                dot={false} activeDot={{r:4}}
              />
            ))}
            {activeStation === 'all' && (
              <Line
                type="monotone" dataKey="overall"
                stroke="#1a1a1a" strokeWidth={2.5}
                strokeDasharray="5 3" dot={false}
                name="Overall avg"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Station bar chart */}
      <div className="chart-wrap">
        <div className="chart-title">Annual average AQI by station</div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={stationBars} margin={{top:4, right:8, left:-20, bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="label" tick={{fontSize:10, fill:'#a3a3a3'}}/>
            <YAxis tick={{fontSize:11, fill:'#a3a3a3'}}/>
            <Tooltip
              formatter={(v,_,props) => [
                `${v} — ${aqiLabel(v)}`,
                props.payload.label
              ]}
            />
            <Bar dataKey="avg" radius={[4,4,0,0]}>
              {stationBars.map(b => (
                <Cell key={b.s} fill={COLORS[b.s]}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Month grid */}
      <div className="section-head">Monthly breakdown</div>
      <div className="month-grid">
        {monthlyData.map(m => (
          <div key={m.month} className="month-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <span className="month-name">{m.short}</span>
              {m.overall != null && (
                <span className={`aqi-chip ${aqiClass(m.overall)}`}>{m.overall}</span>
              )}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, Math.round((m.overall||0)/350*100))}%`,
                  background: aqiColor(m.overall)
                }}
              />
            </div>
            {visibleStations.map(s => (
              <div key={s} className="station-row">
                <span className="station-name">{LABELS[s]}</span>
                <span className="station-val" style={{color: aqiColor(m[s])}}>{m[s] ?? '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* AQI scale */}
      <div className="aqi-scale">
        <div className="aqi-scale-title">AQI scale — PM2.5</div>
        <div className="aqi-scale-items">
          {[
            ['≤50', 'Good', 'aqi-good'],
            ['51–100', 'Moderate', 'aqi-moderate'],
            ['101–150', 'Unhealthy (sensitive)', 'aqi-ufs'],
            ['151–200', 'Unhealthy', 'aqi-unhealthy'],
            ['201–300', 'Very unhealthy', 'aqi-very'],
            ['301+', 'Hazardous', 'aqi-hazardous'],
          ].map(([range, label, cls]) => (
            <span key={range} className={`aqi-chip ${cls}`} style={{fontSize:11, padding:'3px 10px'}}>
              {range} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AirPollution;
