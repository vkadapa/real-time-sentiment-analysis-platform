import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import SentimentGauge from './components/panels/SentimentGauge';
import GeoHeatMap from './components/panels/GeoHeatMap';
import ProductSentiment from './components/panels/ProductSentiment';
import ChannelPerformance from './components/panels/ChannelPerformance';
import EmotionDistribution from './components/panels/EmotionDistribution';
import TrendTimeline from './components/panels/TrendTimeline';
import './App.css';

function App() {
  const { isConnected, lastMessage, metrics } = useWebSocket();

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>ENBD Real-Time Sentiment Analysis</h1>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="dashboard">
        <div className="dashboard-grid">
          {/* Row 1 */}
          <div className="panel-wrapper">
            <SentimentGauge metrics={metrics} />
          </div>

          <div className="panel-wrapper">
            <GeoHeatMap />
          </div>

          {/* Row 2 */}
          <div className="panel-wrapper">
            <ProductSentiment />
          </div>

          <div className="panel-wrapper">
            <ChannelPerformance />
          </div>

          {/* Row 3 */}
          <div className="panel-wrapper">
            <EmotionDistribution metrics={metrics} />
          </div>

          <div className="panel-wrapper">
            <TrendTimeline lastMessage={lastMessage} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Emirates NBD | Real-Time Sentiment Intelligence Platform | Last Update: {new Date().toLocaleTimeString()}</p>
      </footer>
    </div>
  );
}

export default App;
