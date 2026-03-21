import React, { useState, useMemo } from 'react';
import parliamentData from '../data/heatwave/parliament.json';

// ── Helpers ──────────────────────────────────────────────────────
function parseDate(str) {
  // "24-Jul-2024" → Date
  const parts = str.split('-');
  if (parts.length !== 3) return new Date(0);
  return new Date(`${parts[1]} ${parts[0]} ${parts[2]}`);
}

function formatDate(str) {
  try {
    return parseDate(str).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch { return str; }
}

function ministryShort(m) {
  const map = {
    'EARTH SCIENCES': 'Earth Sciences',
    'FISHERIES, ANIMAL HUSBANDRY AND DAIRYING': 'Fisheries & Dairying',
  };
  return map[m] || m.split(' ').map(w => w[0]+w.slice(1).toLowerCase()).join(' ');
}

function ministryBadgeClass(m) {
  if (m === 'EARTH SCIENCES') return 'badge badge-earth';
  if (m.includes('FISHERIES')) return 'badge badge-fisheries';
  return 'badge badge-other';
}

// ── Question card ─────────────────────────────────────────────────
function QuestionCard({ q }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="q-card">
      <div className="q-card-header">
        <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
          <span className="q-id">Q {q.id}</span>
          <span className="badge badge-unstarred">{q.type}</span>
        </div>
        <div className="q-subj">{q.subject}</div>
        <div className="q-meta">
          <span className={ministryBadgeClass(q.ministry)}>{ministryShort(q.ministry)}</span>
          <span className="q-date">{formatDate(q.date)}</span>
          <span style={{color:'#d4d4d4'}}>·</span>
          <span className="q-member">{q.member}</span>
        </div>
        <button className="q-toggle" onClick={() => setOpen(o => !o)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {open
              ? <path d="M2 8L6 4L10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              : <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            }
          </svg>
          {open ? 'Hide' : 'Read'} question &amp; answer
        </button>
      </div>

      {open && (
        <div className="q-card-body">
          <div className="q-section-label">Question</div>
          <p className="q-text">{q.question}</p>
          <div className="q-section-label">Government's Answer</div>
          <p className="q-text">{q.answer}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
const HeatWave = () => {
  const [activeMinistry, setActiveMinistry] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  const ministries = useMemo(
    () => [...new Set(parliamentData.map(q => q.ministry))],
    []
  );

  const ministryCounts = useMemo(() => {
    const c = {};
    ministries.forEach(m => { c[m] = parliamentData.filter(q => q.ministry === m).length; });
    return c;
  }, [ministries]);

  const filtered = useMemo(() => {
    let items = activeMinistry === 'all'
      ? [...parliamentData]
      : parliamentData.filter(q => q.ministry === activeMinistry);
    return items.sort((a, b) => {
      const diff = parseDate(b.date) - parseDate(a.date);
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [activeMinistry, sortOrder]);

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Parliament on Heatwaves</h1>
      <p className="page-sub" style={{maxWidth:600}}>
        An archive of parliamentary questions on heatwave policy, deaths, forecasting
        and government response — 2024 to 2025.
      </p>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total questions</div>
          <div className="stat-value" style={{color:'#ea580c'}}>{parliamentData.length}</div>
          <div className="stat-sub">2024 – 2025</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ministries questioned</div>
          <div className="stat-value" style={{color:'#2563eb'}}>{ministries.length}</div>
          <div className="stat-sub">Earth Sciences leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unstarred questions</div>
          <div className="stat-value">{parliamentData.filter(q => q.type === 'UNSTARRED').length}</div>
          <div className="stat-sub">Written answers on record</div>
        </div>
      </div>

      {/* Ministry breakdown */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-head" style={{marginBottom:16}}>Questions by ministry</div>
        {ministries.map(m => {
          const count = ministryCounts[m];
          const pct = Math.round((count / parliamentData.length) * 100);
          return (
            <div key={m} className="ministry-bar">
              <div className="ministry-bar-label">
                <span style={{fontWeight:500, color: m === 'EARTH SCIENCES' ? '#1e40af' : '#166534'}}>
                  {ministryShort(m)}
                </span>
                <span style={{color:'#a3a3a3'}}>{count} question{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="ministry-bar-track">
                <div
                  className="ministry-bar-fill"
                  style={{
                    width:`${pct}%`,
                    background: m === 'EARTH SCIENCES' ? '#3b82f6' : '#22c55e'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter toolbar */}
      <div className="toolbar">
        <span className="toolbar-label">Filter:</span>
        <div className="pills" style={{margin:0}}>
          <button
            className={`pill${activeMinistry === 'all' ? ' active' : ''}`}
            onClick={() => setActiveMinistry('all')}
          >
            All
          </button>
          {ministries.map(m => (
            <button
              key={m}
              className={`pill${activeMinistry === m ? ' active' : ''}`}
              style={activeMinistry === m
                ? {background: m === 'EARTH SCIENCES' ? '#3b82f6' : '#22c55e',
                   borderColor: 'transparent', color:'#fff'}
                : {}}
              onClick={() => setActiveMinistry(m)}
            >
              {ministryShort(m)}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="result-count">
        {filtered.length} question{filtered.length !== 1 ? 's' : ''}
        {activeMinistry !== 'all' && ` · ${ministryShort(activeMinistry)}`}
      </div>

      {/* Cards */}
      {filtered.map(q => <QuestionCard key={q.id} q={q}/>)}

      {/* Coming soon */}
      <div className="coming-soon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" fill="#fcd34d"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{fontWeight:600, color:'#92400e', marginTop:8}}>More heatwave data coming soon</p>
        <p>State-level heat deaths · IMD alerts · Heat Action Plans</p>
      </div>
    </div>
  );
};

export default HeatWave;
