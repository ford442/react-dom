import { pipeline } from '@huggingface/transformers';

/**
 * Predicts future cryptocurrency prices using a pre-trained time-series model.
 * @param {number[]} historicalPrices - An array of historical prices.
 * @param {number} predictionLength - The number of future time steps to predict.
 * @returns {Promise<number[]|null>} A promise that resolves to an array of predicted prices or null if an error occurs.
 */
export const predictFuturePrices = async (historicalPrices, predictionLength = 30) => {
  try {
    // Load the time-series forecasting pipeline with a specific model
    const forecaster = await pipeline('time-series-forecasting', 'Xenova/autots-m3-monthly');

    // Make a prediction
    const prediction = await forecaster(historicalPrices, {
      prediction_length: predictionLength,
    });
    
    // Extract the predicted values
    return prediction[0].generated_text.split(',').map(Number);

  } catch (error) {
    console.error("Error during price prediction:", error);
    return null;
  }
};

/**
 * Calculates the Simple Moving Average (SMA) for a set of prices.
 * @param {number[]} prices - An array of prices.
 * @param {number} windowSize - The size of the moving average window.
 * @returns {Array<number|null>} An array of SMA values.
 */
export const calculateSMA = (prices, windowSize) => {
    if (prices.length < windowSize) {
        return new Array(prices.length).fill(null);
    }

    const sma = [];
    for (let i = 0; i <= prices.length - windowSize; i++) {
        const window = prices.slice(i, i + windowSize);
        const average = window.reduce((sum, val) => sum + val, 0) / windowSize;
        sma.push(average);
    }
    // Pad the start of the array with nulls so it aligns with the original price data
    return new Array(windowSize - 1).fill(null).concat(sma);
};
