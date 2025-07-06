import React, { useState, useEffect } from 'react';
import PriceChart from './components/PriceChart';
import { getHistoricalData } from './services/cryptoApi';
import { predictFuturePrices, calculateSMA } from './services/analysis';
import './App.css';

function App() {
  // State variables to hold our data and loading status
  const [coinId, setCoinId] = useState('bitcoin');
  const [historicalData, setHistoricalData] = useState([]);
  const [predictedData, setPredictedData] = useState(null);
  const [sma50, setSma50] = useState(null);
  const [sma200, setSma200] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // useEffect hook to fetch data whenever the coinId changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // 1. Fetch historical data
      const historical = await getHistoricalData(coinId, 365);
      setHistoricalData(historical);

      if (historical.length > 0) {
        const prices = historical.map(p => p[1]);
        
        // 2. Calculate trends (SMAs)
        setSma50(calculateSMA(prices, 50));
        setSma200(calculateSMA(prices, 200));

        // 3. Predict future prices
        const predictions = await predictFuturePrices(prices, 30);
        setPredictedData(predictions);
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [coinId]); // This effect re-runs whenever 'coinId' changes

  return (
    <div className="App">
      <header className="App-header">
        <h1>Crypto Price Analyzer</h1>
        <p>Predicting future prices and identifying trends with AI.</p>
      </header>
      <main>
        <div className="controls">
          <label htmlFor="coin-select">Select a Cryptocurrency:</label>
          <select 
            id="coin-select" 
            value={coinId} 
            onChange={(e) => setCoinId(e.target.value)}
            disabled={isLoading}
          >
            <option value="bitcoin">Bitcoin</option>
            <option value="ethereum">Ethereum</option>
            <option value="dogecoin">Dogecoin</option>
            <option value="cardano">Cardano</option>
          </select>
        </div>
        <div className="chart-container">
          {isLoading ? (
            <div className="loading-indicator">
                <p>Loading Model and Analyzing Data...</p>
                <div className="spinner"></div>
            </div>
          ) : (
            <PriceChart 
              historicalData={historicalData}
              predictedData={predictedData}
              sma50Data={sma50}
              sma200Data={sma200}
              coinId={coinId}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
