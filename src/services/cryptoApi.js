import axios from 'axios';

const API_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Fetches historical market data for a specific cryptocurrency.
 * @param {string} coinId - The ID of the cryptocurrency (e.g., 'bitcoin').
 * @param {number} days - The number of days to fetch data for.
 * @returns {Promise<Array<[number, number]>>} A promise that resolves to an array of [timestamp, price] tuples.
 */
export const getHistoricalData = async (coinId = 'bitcoin', days = 365) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days: days,
        interval: 'daily',
      },
    });
    // We only need the prices from the response
    return response.data.prices;
  } catch (error) {
    console.error("Error fetching historical data:", error);
    // Return an empty array in case of an error
    return [];
  }
};
