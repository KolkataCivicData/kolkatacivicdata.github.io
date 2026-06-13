import React, { useState } from 'react';
import AirPollution from './pages/AirPollution';
import HeatWave from './pages/HeatWave';

function App() {
  const [currentPage, setCurrentPage] = useState('pollution');

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-brand">Kolkata Civic Data</span>
        <button
          className={`nav-btn${currentPage === 'pollution' ? ' active' : ''}`}
          onClick={() => setCurrentPage('pollution')}
        >
          Air Pollution
        </button>
        <button
          className={`nav-btn${currentPage === 'heatwave' ? ' active' : ''}`}
          onClick={() => setCurrentPage('heatwave')}
        >
          Heatwave &amp; Parliament
        </button>
        <a className="nav-btn" href={`${process.env.PUBLIC_URL}/lst/`}>
          LST Map
        </a>
        <a className="nav-btn" href={`${process.env.PUBLIC_URL}/lst/static.html`}>
          LST Heatmap
        </a>
      </nav>
      <main className="main">
        {currentPage === 'pollution' ? <AirPollution /> : <HeatWave />}
      </main>
    </div>
  );
}

export default App;
