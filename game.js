import { sdk } from 'https://esm.sh/@farcaster/miniapp-sdk';
import { encodeFunctionData, decodeFunctionResult } from 'https://esm.sh/viem';

const CONFIG = {
  CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000',
  CHAIN_ID: 84532,
  MAX_CLAIM: 100
};

const CONTRACT_ABI = [
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
    outputs: [{ type: 'uint256' }],
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

let pendingTaps = 0;
let userAddress = null;
let provider = null;

const elements = {
  totalPoints: document.getElementById('totalPoints'),
  userRank: document.getElementById('userRank'),
  tapCount: document.getElementById('tapCount'),
  btnTap: document.getElementById('btnTap'),
  btnClaim: document.getElementById('btnClaim'),
  claimCount: document.getElementById('claimCount'),
  loadingState: document.getElementById('loadingState'),
  successState: document.getElementById('successState'),
  successCount: document.getElementById('successCount'),
  btnAgain: document.getElementById('btnAgain'),
  leaderboardList: document.getElementById('leaderboardList'),
  connectionStatus: document.getElementById('connectionStatus'),
  statusText: document.getElementById('statusText'),
  statusDot: document.querySelector('.status-dot')
};

async function init() {
  try {
    if (sdk?.actions?.ready) await sdk.actions.ready();

    let p = sdk.wallet?.getEthereumProvider?.() ?? sdk.wallet?.ethProvider;
    provider = (p && typeof p.then === 'function') ? await p : (p ?? window.ethereum);

    if (provider) {
      try {
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        if (chainId !== CONFIG.CHAIN_ID) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }]
            });
          } catch (_) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`,
                chainName: 'Base Sepolia',
                rpcUrls: ['https://sepolia.base.org']
              }]
            });
          }
        }
      } catch (_) {}
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      userAddress = accounts[0];
      updateConnectionStatus('connected', formatAddress(userAddress));
      await loadUserData();
      await loadLeaderboard();
    } else {
      updateConnectionStatus('error', 'No wallet');
    }
  } catch (e) {
    console.error(e);
    updateConnectionStatus('error', 'Connection failed');
  }

  elements.btnTap.addEventListener('click', handleTap);
  elements.btnTap.addEventListener('touchstart', (e) => { e.preventDefault(); handleTap(); });
  elements.btnClaim.addEventListener('click', claimPoints);
  elements.btnClaim.addEventListener('touchstart', (e) => { e.preventDefault(); claimPoints(); });
  elements.btnAgain.addEventListener('click', hideSuccess);
  elements.btnAgain.addEventListener('touchstart', (e) => { e.preventDefault(); hideSuccess(); });
}

function handleTap() {
  if (pendingTaps >= CONFIG.MAX_CLAIM) return;
  pendingTaps++;
  elements.tapCount.textContent = pendingTaps;
  elements.btnTap.style.transform = 'scale(0.9)';
  setTimeout(() => { elements.btnTap.style.transform = 'scale(1)'; }, 50);

  if (pendingTaps > 0) {
    elements.btnClaim.style.display = 'block';
    elements.btnClaim.querySelector('#claimCount').textContent = pendingTaps;
  }
}

async function claimPoints() {
  if (pendingTaps === 0 || !provider) return;

  elements.btnClaim.style.display = 'none';
  elements.btnTap.style.display = 'none';
  elements.loadingState.style.display = 'block';

  try {
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'tapMultiple',
      args: [BigInt(pendingTaps)]
    });

    await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        to: CONFIG.CONTRACT_ADDRESS,
        from: userAddress,
        data
      }]
    });

    showSuccess(pendingTaps);
    pendingTaps = 0;
    elements.tapCount.textContent = '0';

    setTimeout(async () => {
      await loadUserData();
      await loadLeaderboard();
    }, 2000);
  } catch (e) {
    console.error(e);
    alert('Transaction failed. Try again.');
    elements.loadingState.style.display = 'none';
    elements.btnClaim.style.display = 'block';
    elements.btnClaim.querySelector('#claimCount').textContent = pendingTaps;
    elements.btnTap.style.display = 'block';
  }
}

function showSuccess(count) {
  elements.loadingState.style.display = 'none';
  elements.successState.style.display = 'block';
  elements.successCount.textContent = `${count} points added`;
}

function hideSuccess() {
  elements.successState.style.display = 'none';
  elements.btnTap.style.display = 'block';
}

async function loadUserData() {
  if (!userAddress || !provider) return;
  try {
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'userTaps',
      args: [userAddress]
    });
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: CONFIG.CONTRACT_ADDRESS, data }, 'latest']
    });
    const [points] = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: 'userTaps',
      data: result
    });
    elements.totalPoints.textContent = Number(points).toLocaleString();
  } catch (e) {
    console.error(e);
  }
}

async function loadLeaderboard() {
  if (!provider) {
    renderLeaderboard([]);
    return;
  }
  try {
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'getLeaderboard',
      args: [0n, 10n]
    });
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: CONFIG.CONTRACT_ADDRESS, data }, 'latest']
    });
    const [addresses, taps] = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: 'getLeaderboard',
      data: result
    });
    const entries = addresses.map((addr, i) => ({
      address: addr,
      taps: Number(taps[i])
    }));
    renderLeaderboard(entries);
  } catch (e) {
    console.error(e);
    renderLeaderboard([]);
  }
}

function renderLeaderboard(entries) {
  if (entries.length === 0) {
    elements.leaderboardList.innerHTML = '<div class="leaderboard-empty">No players yet</div>';
    return;
  }
  entries.sort((a, b) => b.taps - a.taps);
  let html = '';
  entries.forEach((e, i) => {
    const rank = i + 1;
    const isMe = e.address.toLowerCase() === userAddress?.toLowerCase();
    const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    html += `
      <div class="leaderboard-item ${isMe ? 'me' : ''}">
        <div class="leaderboard-left">
          <span class="leaderboard-rank">${icon}</span>
          <span class="leaderboard-address">${formatAddress(e.address)}</span>
        </div>
        <span class="leaderboard-taps">${e.taps.toLocaleString()}</span>
      </div>`;
    if (isMe) elements.userRank.textContent = `#${rank}`;
  });
  elements.leaderboardList.innerHTML = html;
}

function updateConnectionStatus(status, text) {
  elements.statusText.textContent = text;
  elements.statusDot.className = 'status-dot';
  if (status === 'connected') elements.statusDot.classList.add('connected');
  else if (status === 'error') elements.statusDot.classList.add('error');
}

function formatAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

init();
