const progress = document.querySelector('.progress span');
let value = 58;

setInterval(() => {
  value = value >= 88 ? 48 : value + 2;
  if (progress) {
    progress.style.width = `${value}%`;
  }
}, 1200);

const monanimals = [
  'SALMONAD',
  'CHOG',
  'SNELLY',
  'MOYAKI',
  'SALANDAK',
  'HONK',
  'MOKADEL',
  'LYRAFFE',
  'SPIDERMON',
  'MONTIGER',
  'MOLANDAK',
  'MOUCH',
  'MOXY',
  'BIRBIE',
  'MONCOCK',
];

const fallbackBots = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    tag: 'Mantık ve akıl yürütme şampiyonu',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tag: 'Kodlama ve insani nüanslarda uzman',
  },
  {
    id: 'gemini-1-5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    tag: 'Çok büyük veri işleme kapasitesi',
  },
  {
    id: 'llama-3',
    name: 'Llama 3',
    provider: 'Meta',
    tag: 'Açık kaynağın en güçlü temsilcisi',
  },
  {
    id: 'midjourney-v6',
    name: 'Midjourney v6',
    provider: 'Midjourney',
    tag: 'Estetik ve yaratıcılık lideri',
  },
  {
    id: 'dalle-3',
    name: 'DALL·E 3',
    provider: 'OpenAI',
    tag: 'Prompt sadakati yüksek görsel sanatçı',
  },
];

const sampleBets = [
  {
    id: 'sample-1',
    prompt: 'Örnek Prompt: GPT-5 vs Claude',
    pot: 1200,
    remaining: '00:17:24',
  },
  {
    id: 'sample-2',
    prompt: 'Örnek Prompt: GPT-5 mi Claude mu daha iyi özet çıkarır?',
    pot: 860,
    remaining: '01:03:11',
  },
  {
    id: 'sample-3',
    prompt: 'Örnek Prompt: GPT-5 ve Claude için hızlı kodlama yarışı',
    pot: 540,
    remaining: '00:42:05',
  },
  {
    id: 'sample-4',
    prompt: 'Örnek Prompt: GPT-5 vs Claude - hata ayıklama sprinti',
    pot: 720,
    remaining: '00:28:40',
  },
  {
    id: 'sample-5',
    prompt: 'Örnek Prompt: GPT-5 vs Claude - ürün metni yazımı',
    pot: 610,
    remaining: '00:55:18',
  },
];

const MONAD_TESTNET = {
  chainId: '0x279f',
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://testnet-rpc.monad.xyz/'],
  blockExplorerUrls: ['http://testnet.monadexplorer.com/'],
};

const TREASURY_ADDRESS = '0xc21667E5230bb10c0f725E89d7Cf331469EddD5B';

const state = {
  markets: [],
  wallet: null,
  selectedMarket: null,
  bots: fallbackBots,
};

const $ = (selector) => document.querySelector(selector);

const walletConnect = $('#wallet-connect');
const walletStatus = $('#wallet-status');
const walletBox = document.querySelector('.wallet');
const wagerWallet = $('#wager-wallet');
const marketForm = $('#market-form');
const marketMessage = $('#market-message');
const marketList = $('#market-list');
const botASelect = $('#bot-a');
const botBSelect = $('#bot-b');
const refreshBots = $('#refresh-bots');
const wagerForm = $('#wager-form');
const wagerMessage = $('#wager-message');
const wagerPick = $('#wager-pick');
const navBets = $('#nav-bets');
const navArena = $('#nav-arena');
const goArena = $('#go-arena');
const arenaSection = $('#arena');
const openBets = $('#open-bets');
const betsList = $('#bets-list');
const createBetButton = $('#create-bet');
const arenaPrompt = $('#arena-prompt');
const arenaResult = $('#arena-result');
const fighterLeft = $('#fighter-left');
const fighterRight = $('#fighter-right');
const monanimalsGrid = $('#monanimals-grid');

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'İstek başarısız');
  }
  return response.json();
}

function getBotLabel(bot) {
  if (!bot) return 'AI';
  const base = `${bot.provider || 'AI'} - ${bot.name || bot.id || 'Model'}`;
  return bot.tag ? `${base} (${bot.tag})` : base;
}

function renderBotSelects() {
  if (!botASelect || !botBSelect) return;
  const currentA = botASelect.value;
  const currentB = botBSelect.value;
  const options = state.bots
    .map((bot) => `<option value="${bot.id}">${getBotLabel(bot)}</option>`)
    .join('');
  botASelect.innerHTML = options;
  botBSelect.innerHTML = options;
  if (currentA) botASelect.value = currentA;
  if (currentB) botBSelect.value = currentB;
  if (!botASelect.value && state.bots[0]) botASelect.value = state.bots[0].id;
  if (!botBSelect.value && state.bots[1]) botBSelect.value = state.bots[1].id;
  if (!botBSelect.value && state.bots[0]) botBSelect.value = state.bots[0].id;
  syncPickBots(botASelect.value, botBSelect.value);
}

function syncPickBots(botAId, botBId) {
  if (!wagerPick) return;
  if (!botAId || !botBId) {
    wagerPick.innerHTML = '';
    return;
  }
  const botA = state.bots.find((bot) => bot.id === botAId);
  const botB = state.bots.find((bot) => bot.id === botBId);
  wagerPick.innerHTML = `
    <option value="${botAId}">${getBotLabel(botA)}</option>
    <option value="${botBId}">${getBotLabel(botB)}</option>
  `;
  wagerPick.value = botAId;
}

function normalizeTime(value) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function sortMarketsByDate(markets) {
  return [...markets].sort((a, b) => {
    const timeA = normalizeTime(a.scheduledAt || a.createdAt);
    const timeB = normalizeTime(b.scheduledAt || b.createdAt);
    return timeA - timeB;
  });
}

function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function updateWalletUI(account) {
  if (walletStatus) {
    walletStatus.textContent = account ? 'Bağlandı' : 'Bağlı değil';
  }
  if (walletConnect) {
    walletConnect.textContent = account ? `Bağlandı: ${formatAddress(account)}` : 'Cüzdan Bağla';
  }
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address || '');
}

function parseMonToWei(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return 0n;
  const [whole, fraction = ''] = normalized.split('.');
  const wholeWei = BigInt(whole || '0') * 10n ** 18n;
  const fracPadded = (fraction + '0'.repeat(18)).slice(0, 18);
  const fractionWei = BigInt(fracPadded || '0');
  return wholeWei + fractionWei;
}

async function ensureMonadNetwork() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET.chainId }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [MONAD_TESTNET],
      });
    } else {
      throw error;
    }
  }
}

function setWallet(account) {
  state.wallet = account || null;
  updateWalletUI(account);
  if (wagerWallet) wagerWallet.value = account || '';
  wagerForm?.querySelector('button[type="submit"]')?.toggleAttribute('disabled', !account);
}

async function connectWallet() {
  if (!window.ethereum) {
    if (walletStatus) {
      walletStatus.textContent =
        window.location.protocol === 'file:'
          ? 'localhost üzerinden aç'
          : 'MetaMask gerekli';
    }
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await ensureMonadNetwork();
    setWallet(accounts?.[0] || null);
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = error?.message
        ? `Bağlantı reddedildi: ${error.message}`
        : 'Bağlantı reddedildi';
    }
  }
}

async function handleCreateBet() {
  if (!marketForm || !wagerForm) return;
  if (createBetButton) createBetButton.setAttribute('disabled', 'true');
  marketMessage.textContent = '';
  wagerMessage.textContent = '';

  const botAId = botASelect?.value;
  const botBId = botBSelect?.value;
  if (!botAId || !botBId) {
    marketMessage.textContent = 'Lütfen iki AI modeli seç.';
    return;
  }

  const promptValue = marketForm.querySelector('#market-prompt')?.value?.trim();
  if (!promptValue) {
    marketMessage.textContent = 'Prompt girmen gerekli.';
    return;
  }

  if (!state.wallet) {
    await connectWallet();
    if (!state.wallet) {
      wagerMessage.textContent = 'Cüzdan bağlamalısın.';
      return;
    }
  }

  const amountValue = Number(wagerForm.querySelector('#wager-amount')?.value || 0);
  if (!amountValue || amountValue <= 0) {
    wagerMessage.textContent = 'Miktar girmelisin.';
    return;
  }

  const pickBotId = wagerPick?.value;
  if (!pickBotId) {
    wagerMessage.textContent = 'Seçilen AI gerekli.';
    return;
  }

  marketMessage.textContent = 'Piyasa oluşturuluyor...';
  try {
    await ensureMonadNetwork();
    const amountWei = parseMonToWei(amountValue);
    if (amountWei <= 0n) {
      wagerMessage.textContent = 'Geçerli miktar gir.';
      return;
    }
    wagerMessage.textContent = 'MetaMask onayı bekleniyor...';
    await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: state.wallet,
          to: TREASURY_ADDRESS,
          value: `0x${amountWei.toString(16)}`,
        },
      ],
    });

    const formData = new FormData(marketForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.scheduledAt) {
      delete payload.scheduledAt;
    } else {
      payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
    }
    payload.botAId = botAId;
    payload.botBId = botBId;

    const createdMatch = await fetchJson('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    marketMessage.textContent = 'İddia gönderiliyor...';
    await fetchJson('/api/wagers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: createdMatch.id,
        bettor: state.wallet,
        amount: amountValue,
        pickBotId,
      }),
    });

    marketMessage.textContent = 'İddia oluşturuldu.';
    wagerMessage.textContent = 'Tahmin gönderildi.';
    loadMarkets();
    setTimeout(() => {
      window.location.href = 'bets.html#bets';
    }, 200);
  } catch (error) {
    marketMessage.textContent = error.message;
  } finally {
    if (createBetButton) createBetButton.removeAttribute('disabled');
  }
}

function renderMarkets() {
  if (!marketList) return;
  if (!state.markets.length) {
    marketList.innerHTML = '<div class="list-item">Henüz piyasa yok.</div>';
    return;
  }
  marketList.innerHTML = state.markets
    .map((market) => {
      const prompt = market.prompt || 'Prompt yok';
      return `
        <div class="list-item">
          <strong>${prompt}</strong>
          <span>Durum: ${market.status}</span>
          <span>Pot: ${market.summary?.totalPot || 0} MONAD</span>
          <span>id: ${market.id}</span>
        </div>
      `;
    })
    .join('');
}

function renderBets() {
  if (!betsList) return;
  if (!state.markets.length) {
    if (document.body?.dataset.page === 'bets') {
      betsList.innerHTML = sampleBets
        .map(
          (bet) => `
        <div class="bets-item is-clickable" data-bet-id="${bet.id}" role="link" tabindex="0">
          <div class="bets-prompt">${bet.prompt}</div>
          <div class="bets-ring">
            <div class="fighter" data-side="left">
              <div class="mascot-badge" data-name="SALMONAD"></div>
              <span class="fighter-name">AI 1</span>
            </div>
            <div class="vs">VS</div>
            <div class="fighter" data-side="right">
              <div class="mascot-badge" data-name="CHOG"></div>
              <span class="fighter-name">AI 2</span>
            </div>
          </div>
          <div class="bets-meta">
            <span class="muted">Kalan süre: ${bet.remaining}</span>
            <span>Pot: ${bet.pot} MONAD</span>
          </div>
        </div>
      `
        )
        .join('');
      return;
    }
    betsList.innerHTML = '<div class="bets-item">Henüz iddia yok.</div>';
    return;
  }
  betsList.innerHTML = state.markets
    .map((market) => {
      const prompt = market.prompt || 'Prompt yok';
      const botA = state.bots.find((bot) => bot.id === market.botAId);
      const botB = state.bots.find((bot) => bot.id === market.botBId);
      const botALabel = getBotLabel(botA);
      const botBLabel = getBotLabel(botB);
      return `
        <div class="bets-item is-clickable" data-bet-id="${market.id}" role="link" tabindex="0">
          <div class="bets-prompt">${prompt}</div>
          <div class="bets-ring">
            <div class="fighter" data-side="left">
              <div class="mascot-badge" data-name="SALMONAD"></div>
              <span class="fighter-name">${botALabel}</span>
            </div>
            <div class="vs">VS</div>
            <div class="fighter" data-side="right">
              <div class="mascot-badge" data-name="CHOG"></div>
              <span class="fighter-name">${botBLabel}</span>
            </div>
          </div>
          <div class="bets-meta">
            <span class="muted">Kalan süre: 00:00:00</span>
            <span>Pot: ${market.summary?.totalPot || 0} MONAD</span>
          </div>
          <a class="ghost small" href="ring.html?id=${market.id}">Ring'e Git</a>
        </div>
      `;
    })
    .join('');
}

function initBetRouting() {
  if (!betsList) return;
  const goToRing = (betId) => {
    if (!betId) return;
    window.location.assign(`ring.html?id=${betId}`);
  };

  betsList.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) return;
    const item = event.target.closest('.bets-item.is-clickable');
    if (!item) return;
    goToRing(item.dataset.betId);
  });

  betsList.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('.bets-item.is-clickable');
    if (!item) return;
    event.preventDefault();
    goToRing(item.dataset.betId);
  });
}



function renderMonanimals() {
  if (!monanimalsGrid) return;
  monanimalsGrid.innerHTML = monanimals
    .map(
      (name) => `
        <div class="monanimal-card">
          <div class="mascot-badge" data-name="${name}"></div>
          <span>${name}</span>
        </div>
      `
    )
    .join('');
}

function pickMascots() {
  const left = monanimals[Math.floor(Math.random() * monanimals.length)];
  let right = monanimals[Math.floor(Math.random() * monanimals.length)];
  if (right === left) right = monanimals[(monanimals.indexOf(left) + 1) % monanimals.length];
  fighterLeft?.querySelector('.mascot-badge')?.setAttribute('data-name', left);
  const leftName = fighterLeft?.querySelector('.fighter-name');
  if (leftName) leftName.textContent = left;
  fighterRight?.querySelector('.mascot-badge')?.setAttribute('data-name', right);
  const rightName = fighterRight?.querySelector('.fighter-name');
  if (rightName) rightName.textContent = right;
  return { left, right };
}

function playArena() {
  if (!state.selectedMarket) {
    if (arenaResult) arenaResult.textContent = 'Önce bir iddia seç.';
    return;
  }
  const { left, right } = pickMascots();
  if (arenaPrompt) arenaPrompt.textContent = state.selectedMarket.prompt || 'Prompt yok';
  const winner = Math.random() > 0.5 ? left : right;
  if (arenaResult) arenaResult.textContent = `Kazanan: ${winner}`;
}

async function loadMarkets() {
  try {
    const markets = await fetchJson('/api/matches');
    state.markets = sortMarketsByDate(markets);
    renderMarkets();
    renderBets();
    syncPickBots(botASelect?.value, botBSelect?.value);
  } catch (error) {
    if (marketList) {
      marketList.innerHTML = `<div class="list-item">${error.message}</div>`;
    } else if (betsList) {
      betsList.innerHTML = `<div class="bets-item">${error.message}</div>`;
    }
  }
}

marketForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  marketMessage.textContent = 'Gönderiliyor...';
  const botAId = botASelect?.value;
  const botBId = botBSelect?.value;
  if (!botAId || !botBId) {
    marketMessage.textContent = 'Lütfen iki AI modeli seç.';
    return;
  }
  const formData = new FormData(marketForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.scheduledAt) {
    delete payload.scheduledAt;
  } else {
    payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
  }
  payload.botAId = botAId;
  payload.botBId = botBId;
  try {
    await fetchJson('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    marketMessage.textContent = 'Piyasa oluşturuldu.';
    marketForm.reset();
    loadMarkets();
  } catch (error) {
    marketMessage.textContent = error.message;
  }
});

wagerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.wallet) {
    wagerMessage.textContent = 'Cüzdan bağlamalısın.';
    return;
  }
  wagerMessage.textContent = 'Gönderiliyor...';
  const formData = new FormData(wagerForm);
  const payload = Object.fromEntries(formData.entries());
  const matchId = state.markets[0]?.id;
  if (!matchId) {
    wagerMessage.textContent = 'Önce piyasa oluşturmalısın.';
    return;
  }
  const apiPayload = {
    matchId,
    bettor: state.wallet,
    amount: Number(payload.amount),
    pickBotId: payload.pickBotId,
  };
  try {
    await fetchJson('/api/wagers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });
    wagerMessage.textContent = 'Tahmin gönderildi.';
    wagerForm.reset();
    loadMarkets();
  } catch (error) {
    wagerMessage.textContent = error.message;
  }
});

refreshBots?.addEventListener('click', () => {
  loadBots();
});
const syncWinnerOptions = () => syncPickBots(botASelect?.value, botBSelect?.value);

botASelect?.addEventListener('change', syncWinnerOptions);
botBSelect?.addEventListener('change', syncWinnerOptions);
refreshBots?.addEventListener('click', syncWinnerOptions);
walletConnect?.addEventListener('click', connectWallet);
walletBox?.addEventListener('click', connectWallet);
walletStatus?.addEventListener('click', connectWallet);
wagerWallet?.addEventListener('click', connectWallet);
createBetButton?.addEventListener('click', handleCreateBet);
navBets?.addEventListener('click', () => {
  document.getElementById('bets')?.scrollIntoView({ behavior: 'smooth' });
});
const revealArena = () => {
  if (arenaSection) arenaSection.classList.remove('is-hidden');
  document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth' });
};

navArena?.addEventListener('click', (event) => {
  event.preventDefault();
  revealArena();
});
goArena?.addEventListener('click', () => {
  revealArena();
});
openBets?.addEventListener('click', () => {
  document.getElementById('bets')?.scrollIntoView({ behavior: 'smooth' });
});

if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    setWallet(accounts?.[0] || null);
  });
}

async function loadBots() {
  try {
    const bots = await fetchJson('/api/bots');
    state.bots = Array.isArray(bots) && bots.length ? bots : fallbackBots;
    renderBotSelects();
    syncPickBots(botASelect?.value, botBSelect?.value);
  } catch (error) {
    state.bots = fallbackBots;
    renderBotSelects();
    syncPickBots(botASelect?.value, botBSelect?.value);
  }
}

setWallet(null);
if (window.ethereum) {
  window.ethereum
    .request({ method: 'eth_accounts' })
    .then((accounts) => setWallet(accounts?.[0] || null))
    .catch(() => {
      updateWalletUI(null);
    });
}
wagerWallet?.addEventListener('input', (event) => {
  const value = event.target.value.trim();
  if (isValidAddress(value)) {
    setWallet(value);
  }
});
renderMonanimals();
loadBots();
loadMarkets();
initBetRouting();
setInterval(loadMarkets, 8000);
syncWinnerOptions();
