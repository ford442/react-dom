import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { format } from 'date-fns';

// Register the necessary components with Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Renders an interactive price chart.
 * @param {object} props - The component's props.
 * @param {Array<[number, number]>} props.historicalData - The historical price data.
 * @param {number[]|null} props.predictedData - The predicted price data.
 * @param {number[]|null} props.sma50Data - The 50-day SMA data.
 * @param {number[]|null} props.sma200Data - The 200-day SMA data.
 * @param {string} props.coinId - The ID of the cryptocurrency.
 */
const PriceChart = ({ historicalData, predictedData, sma50Data, sma200Data, coinId }) => {
  // Create labels for the historical data (dates)
  const historicalLabels = historicalData.map(dataPoint => format(new Date(dataPoint[0]), 'MMM dd, yyyy'));
  const historicalPrices = historicalData.map(dataPoint => dataPoint[1]);

  // Create future date labels for the prediction
  const lastHistoricalDate = historicalData.length > 0 ? new Date(historicalData[historicalData.length - 1][0]) : new Date();
  const predictionLabels = [];
  if (predictedData) {
    for (let i = 1; i <= predictedData.length; i++) {
        const nextDate = new Date(lastHistoricalDate);
        nextDate.setDate(lastHistoricalDate.getDate() + i);
        predictionLabels.push(format(nextDate, 'MMM dd, yyyy'));
    }
  }

  const data = {
    labels: [...historicalLabels, ...predictionLabels],
    datasets: [
      {
        label: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} Price`,
        data: historicalPrices,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
      {
        label: '50-Day SMA',
        data: sma50Data,
        borderColor: 'rgb(255, 159, 64)',
        borderDash: [5, 5],
        pointRadius: 0, // No points on the trend line
        tension: 0.1,
      },
      {
        label: '200-Day SMA',
        data: sma200Data,
        borderColor: 'rgb(255, 99, 132)',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: 'Predicted Price',
        // Prepend nulls to align prediction with future dates
        data: new Array(historicalPrices.length).fill(null).concat(predictedData),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} Price Chart`,
      },
    },
     scales: {
      y: {
        beginAtZero: false
      }
    }
  };

  return <Line options={options} data={data} />;
};

export default PriceChart;
