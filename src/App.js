import React from 'react';
import AirPollution from './pages/AirPollution';

function App() {
    return (
          <div className="app">
            <nav className="nav">
              <span className="nav-brand">Kolkata Civic Data</span>
          <button className="nav-btn active">
                Air Pollution
      </button>
          <a className="nav-btn" href={`${process.env.PUBLIC_URL}/lst/`}>
          LST
            </a>
        </nav>
      <main className="main">
                    <AirPollution />
            </main>
            </div>
  );
}

export default App;
