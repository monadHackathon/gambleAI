const promptEl = document.getElementById('ring-prompt');
const aiLeftName = document.getElementById('ring-ai-left-name');
const aiRightName = document.getElementById('ring-ai-right-name');
const battleLeftName = document.getElementById('ring-battle-left');
const battleRightName = document.getElementById('ring-battle-right');
const timerEl = document.getElementById('ring-timer');

const fallback = {
  prompt: 'Bu iddia için prompt bulunamadı.',
  botAName: 'AI-1',
  botBName: 'AI-2',
  scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
};

function getBetId() {
  const path = window.location.pathname || '';
  const match = path.match(/\/ring\/(.+)$/);
  return match?.[1] || new URLSearchParams(window.location.search).get('id') || null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('İstek başarısız');
  return response.json();
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startCountdown(targetTime) {
  const target = new Date(targetTime).getTime();
  const tick = () => {
    const now = Date.now();
    const remaining = Math.max(0, target - now);
    timerEl.textContent = `Kalan Süre: ${formatTime(remaining)}`;
  };
  tick();
  setInterval(tick, 1000);
}

function syncBattleNames(left, right) {
  if (battleLeftName) battleLeftName.textContent = left;
  if (battleRightName) battleRightName.textContent = right;
}

async function loadRing() {
  const betId = getBetId();
  if (!betId || betId.startsWith('sample-')) {
    promptEl.textContent = fallback.prompt;
    aiLeftName.textContent = fallback.botAName;
    aiRightName.textContent = fallback.botBName;
    syncBattleNames(fallback.botAName, fallback.botBName);
    startCountdown(fallback.scheduledAt);
    return;
  }

  try {
    const match = await fetchJson(`/api/matches/${betId}`);
    promptEl.textContent = match.prompt || fallback.prompt;
    const leftName = match.botAName || match.botAId || fallback.botAName;
    const rightName = match.botBName || match.botBId || fallback.botBName;
    aiLeftName.textContent = leftName;
    aiRightName.textContent = rightName;
    syncBattleNames(leftName, rightName);
    startCountdown(match.scheduledAt || match.createdAt || fallback.scheduledAt);
  } catch {
    promptEl.textContent = fallback.prompt;
    aiLeftName.textContent = fallback.botAName;
    aiRightName.textContent = fallback.botBName;
    syncBattleNames(fallback.botAName, fallback.botBName);
    startCountdown(fallback.scheduledAt);
  }
}

loadRing();
