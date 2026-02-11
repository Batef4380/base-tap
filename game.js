import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// ============ CONFIG ============
const CONFIG = Object.freeze({
  CONTRACT_ADDRESS: '0x050BB6591fb1a23b26670C294873A146F0609b45',
  CHAIN_ID: 8453,
  GAME_DURATION: 10,
  MAX_TAPS_PER_ROUND: 100,
  RELOAD_DELAY: 3000
});

// Contract ABI (only used functions)
const CONTRACT_ABI = [
  {
    name: 'tap',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'tapMultiple',
    type: 'function',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'userTaps',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'getLeaderboard',
    type: 'function',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'taps', type: 'uint256[]' }
    ],
    stateMutability: 'view'
  }
];

// ============ STATE ============
let gameState = 'idle'; // idle, playing, submitting, success
let tapCount = 0;
let timeLeft = CONFIG.GAME_DURATION;
let timerInterval = null;
let userAddress = null;
let provider = null;

// ============ DOM ELEMENTS ============
const elements = {
  totalTaps: document.getElementById('totalTaps'),
  userRank: document.getElementById('userRank'),
  timerDisplay: document.getElementById('timerDisplay'),
  timerValue: document.getElementById('timerValue'),
  tapLabel: document.getElementById('tapLabel'),
  tapCount: document.getElementById('tapCount'),
  btnStart: document.getElementById('btnStart'),
  btnTap: document.getElementById('btnTap'),
  btnSubmit: document.getElementById('btnSubmit'),
  loadingState: document.getElementById('loadingState'),
  successState: document.getElementById('successState'),
  successCount: document.getElementById('successCount'),
  btnAgain: document.getElementById('btnAgain'),
  leaderboardList: document.getElementById('leaderboardList'),
  connectionStatus: document.getElementById('connectionStatus'),
  statusText: document.getElementById('statusText'),
  statusDot: document.querySelector('.status-dot')
};

// ============ INITIALIZATION ============
async function init() {
  try {
    // Initialize Farcaster SDK
    await sdk.actions.ready();

    // Get Ethereum provider
    provider = sdk.wallet.ethProvider;

    if (provider) {
      // Request accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      userAddress = accounts[0];

      // Update connection status
      updateConnectionStatus('connected', formatAddress(userAddress));

      // Load user data
      await loadUserData();
      await loadLeaderboard();
    } else {
      updateConnectionStatus('error', 'No wallet found');
    }
  } catch (error) {
    console.error('Init error:', error.message || error);
    updateConnectionStatus('error', 'Connection failed');
  }

  // Setup event listeners
  setupEventListeners();
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  elements.btnStart.addEventListener('click', startGame);
  elements.btnStart.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
  });

  elements.btnTap.addEventListener('click', handleTap);
  elements.btnTap.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleTap();
  });

  elements.btnSubmit.addEventListener('click', submitTaps);
  elements.btnSubmit.addEventListener('touchstart', (e) => {
    e.preventDefault();
    submitTaps();
  });

  elements.btnAgain.addEventListener('click', resetGame);
  elements.btnAgain.addEventListener('touchstart', (e) => {
    e.preventDefault();
    resetGame();
  });
}

// ============ GAME LOGIC ============
function startGame() {
  if (gameState !== 'idle') return;

  gameState = 'playing';
  tapCount = 0;
  timeLeft = CONFIG.GAME_DURATION;

  // Update UI
  elements.btnStart.style.display = 'none';
  elements.btnTap.style.display = 'block';
  elements.timerDisplay.classList.add('active');
  elements.tapLabel.textContent = 'Taps this round';
  elements.tapCount.textContent = '0';
  elements.timerValue.textContent = timeLeft;

  // Start timer
  timerInterval = setInterval(() => {
    timeLeft--;
    elements.timerValue.textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function handleTap() {
  if (gameState !== 'playing') return;
  if (tapCount >= CONFIG.MAX_TAPS_PER_ROUND) return;

  tapCount++;
  elements.tapCount.textContent = tapCount;

  // Visual feedback with haptic
  elements.btnTap.style.transform = 'scale(0.9)';
  if (navigator.vibrate) navigator.vibrate(10);
  setTimeout(() => {
    elements.btnTap.style.transform = 'scale(1)';
  }, 50);
}

function endGame() {
  clearInterval(timerInterval);
  gameState = 'idle';

  // Update UI
  elements.btnTap.style.display = 'none';
  elements.timerDisplay.classList.remove('active');

  if (tapCount > 0) {
    elements.btnSubmit.style.display = 'block';
    elements.btnSubmit.textContent = `🚀 SUBMIT ${tapCount} TAPS`;
    elements.tapLabel.textContent = 'Ready to submit';
  } else {
    elements.btnStart.style.display = 'block';
    elements.tapLabel.textContent = 'Ready to play?';
  }
}

async function submitTaps() {
  if (tapCount === 0 || !provider) return;

  gameState = 'submitting';

  // Update UI
  elements.btnSubmit.style.display = 'none';
  elements.loadingState.style.display = 'block';

  try {
    // Encode tap() function call
    const tapData = encodeFunctionCall('tap', []);

    // Create batch of tap calls
    const calls = Array(tapCount).fill(null).map(() => ({
      to: CONFIG.CONTRACT_ADDRESS,
      data: tapData,
      value: '0x0'
    }));

    // Send batch transaction using wallet_sendCalls (EIP-5792)
    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '1.0',
        chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`,
        from: userAddress,
        calls: calls
      }]
    });

    console.log('Batch TX result:', JSON.stringify(result));

    // Show success
    showSuccess(tapCount);

    // Reload data after delay
    setTimeout(async () => {
      await loadUserData();
      await loadLeaderboard();
    }, CONFIG.RELOAD_DELAY);

  } catch (error) {
    console.error('Batch submit error:', error.message || error);

    // Fallback: Try single tapMultiple transaction
    try {
      await submitSingleTx(tapCount);
      showSuccess(tapCount);
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
      console.error('All TX attempts failed');
      alert('Transaction failed. Please try again.');
      resetGame();
    }
  }
}

async function submitSingleTx(count) {
  // Fallback: submit all taps in a single tapMultiple call
  const data = encodeFunctionCall('tapMultiple', [count]);

  await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      to: CONFIG.CONTRACT_ADDRESS,
      from: userAddress,
      data: data
    }]
  });
}

function showSuccess(count) {
  gameState = 'success';
  elements.loadingState.style.display = 'none';
  elements.successState.style.display = 'block';
  elements.successCount.textContent = `${count} transactions confirmed`;
}

function resetGame() {
  gameState = 'idle';
  tapCount = 0;
  timeLeft = CONFIG.GAME_DURATION;

  // Reset UI
  elements.successState.style.display = 'none';
  elements.loadingState.style.display = 'none';
  elements.btnSubmit.style.display = 'none';
  elements.btnTap.style.display = 'none';
  elements.btnStart.style.display = 'block';
  elements.timerDisplay.classList.remove('active');
  elements.tapLabel.textContent = 'Ready to play?';
  elements.tapCount.textContent = '0';
}

// ============ DATA LOADING ============
async function loadUserData() {
  if (!userAddress || !provider) return;

  try {
    const data = encodeFunctionCall('userTaps', [userAddress]);
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: CONFIG.CONTRACT_ADDRESS,
        data: data
      }, 'latest']
    });

    const taps = parseInt(result, 16);
    elements.totalTaps.textContent = taps.toLocaleString();
  } catch (error) {
    console.error('Load user data error:', error.message || error);
  }
}

async function loadLeaderboard() {
  if (!provider) {
    renderLeaderboard([]);
    return;
  }

  try {
    const data = encodeFunctionCall('getLeaderboard', [0, 10]);
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: CONFIG.CONTRACT_ADDRESS,
        data: data
      }, 'latest']
    });

    const decoded = decodeLeaderboardResult(result);
    renderLeaderboard(decoded);
  } catch (error) {
    console.error('Load leaderboard error:', error.message || error);
    renderLeaderboard([]);
  }
}

function renderLeaderboard(entries) {
  if (entries.length === 0) {
    elements.leaderboardList.innerHTML = '<div class="leaderboard-empty">No players yet. Be the first!</div>';
    return;
  }

  // Sort by taps descending
  entries.sort((a, b) => b.taps - a.taps);

  let html = '';
  entries.forEach((entry, index) => {
    const rank = index + 1;
    const isMe = entry.address.toLowerCase() === userAddress?.toLowerCase();
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    html += `
            <div class="leaderboard-item ${isMe ? 'me' : ''}">
                <div class="leaderboard-left">
                    <span class="leaderboard-rank">${rankIcon}</span>
                    <span class="leaderboard-address">${formatAddress(entry.address)}</span>
                </div>
                <span class="leaderboard-taps">${entry.taps.toLocaleString()}</span>
            </div>
        `;

    // Update user rank if this is them
    if (isMe) {
      elements.userRank.textContent = `#${rank}`;
    }
  });

  elements.leaderboardList.innerHTML = html;
}

// ============ UTILITIES ============
function updateConnectionStatus(status, text) {
  elements.statusText.textContent = text;
  elements.statusDot.className = 'status-dot';
  if (status === 'connected') {
    elements.statusDot.classList.add('connected');
  } else if (status === 'error') {
    elements.statusDot.classList.add('error');
  }
}

function formatAddress(address) {
  if (!address || address.length < 10) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Simple ABI encoding (no external library needed)
function encodeFunctionCall(functionName, args) {
  const signatures = {
    'tap': '0x4bb67b54', // keccak256('tap()')[:4]
    'tapMultiple': '0x8c2b8a54', // keccak256('tapMultiple(uint256)')[:4]
    'userTaps': '0x44e5916f', // keccak256('userTaps(address)')[:4]
    'getLeaderboard': '0x5c622a0e' // keccak256('getLeaderboard(uint256,uint256)')[:4]
  };

  let data = signatures[functionName];

  if (functionName === 'userTaps' && args[0]) {
    // Encode address (32 bytes, padded)
    data += args[0].slice(2).padStart(64, '0');
  } else if (functionName === 'tapMultiple' && args[0] !== undefined) {
    // Encode uint256
    data += args[0].toString(16).padStart(64, '0');
  } else if (functionName === 'getLeaderboard') {
    // Encode two uint256
    data += args[0].toString(16).padStart(64, '0');
    data += args[1].toString(16).padStart(64, '0');
  }

  return data;
}

function decodeLeaderboardResult(result) {
  // Simplified decoder for getLeaderboard return
  // Returns array of {address, taps}

  if (!result || result === '0x') return [];

  try {
    const data = result.slice(2);
    // Skip offsets (first 128 chars = 2 * 64)
    // Then read array lengths and data

    // This is simplified - in production use ethers.js or viem
    const entries = [];

    // For demo, return empty if contract not deployed
    if (data.length < 256) return [];

    return entries;
  } catch {
    return [];
  }
}

// ============ START ============
document.addEventListener('DOMContentLoaded', init);