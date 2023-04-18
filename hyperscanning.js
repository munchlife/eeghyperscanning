const Muse = require('muse-js');
const { fft, fftFreq } = require('fft-js');
const WebSocket = require('ws');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Define variables for storing EEG data
let eegData1 = [];
let eegData2 = [];

// Define variables for calculating cross-correlation
const windowSize = 512;
let window1 = new Array(windowSize).fill(0);
let window2 = new Array(windowSize).fill(0);
let crossCorrelation = [];

// Define function to calculate cross-correlation
const calculateCrossCorrelation = () => {
  const crossCorr = new Array(windowSize * 2 - 1).fill(0);

  for (let i = 0; i < windowSize; i++) {
    for (let j = 0; j < windowSize; j++) {
      crossCorr[windowSize - 1 + i - j] += window1[i] * window2[j];
    }
  }

  return crossCorr;
};

// Connect to Muse headsets
const connectMuse = async () => {
  const address1 = 'XX:XX:XX:XX:XX:XX'; // Replace with address of first Muse headset
  const address2 = 'YY:YY:YY:YY:YY:YY'; // Replace with address of second Muse headset

  const muse1 = await Muse.connect(address1);
  const muse2 = await Muse.connect(address2);

  console.log(`Connected to Muse 1: ${muse1.getName()}`);
  console.log(`Connected to Muse 2: ${muse2.getName()}`);

  // Subscribe to EEG stream of each headset
  await Promise.all([
    muse1.eegReadings.subscribe((eeg) => {
      // Add EEG data to window
      window1.push(eeg.data[1]);
      window1.shift();

      // Calculate FFT of window
      const fftData = fft(window1);
      const freqs = fftFreq(fftData, 256);

      // Calculate cross-correlation and send via WebSocket
      if (eegData2.length > 0) {
        window2 = eegData2.slice(-windowSize);
        const crossCorr = calculateCrossCorrelation();
        crossCorrelation = crossCorr.slice(-256);

        const data = {
          timestamp: Date.now(),
          eegData1: eeg.data[1],
          eegData2: eegData2.slice(-1)[0].data[1],
          crossCorrelation: crossCorrelation
        };
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }

      // Store EEG data for cross-correlation calculation
      eegData1.push(eeg);
      if (eegData1.length > windowSize) {
        eegData1.shift();
      }
    }),
    muse2.eegReadings.subscribe((eeg) => {
      // Add EEG data to window
      window2.push(eeg.data[1]);
      window2.shift();

      // Calculate FFT of window
      const fftData = fft(window2);
      const freqs = fftFreq(fftData, 256);
      
 // Calculate cross-correlation and send via WebSocket
 if (eegData1.length > 0 && eegData2.length > 0) {
  const window1 = eegData1.slice(-windowSize);
  const window2 = eegData2.slice(-windowSize);
  const crossCorr1 = calculateCrossCorrelation(window1, window2);
  const crossCorr2 = calculateCrossCorrelation(window2, window1);

  const message1 = { type: 'cross-correlation', data: crossCorr1 };
  const message2 = { type: 'cross-correlation', data: crossCorr2 };

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message1));
      client.send(JSON.stringify(message2));
    }
  });
}
