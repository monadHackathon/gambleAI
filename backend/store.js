import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("backend", "data", "db.json");

const defaultState = {
  bots: [],
  matches: [],
  wagers: [],
  topics: [],
  predictions: [],
  pool: {
    total: 0,
    updatedAt: null,
  },
};

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2));
  }
}

function normalizeState(state) {
  return {
    ...defaultState,
    ...state,
    bots: Array.isArray(state.bots) ? state.bots : [],
    matches: Array.isArray(state.matches) ? state.matches : [],
    wagers: Array.isArray(state.wagers) ? state.wagers : [],
    topics: Array.isArray(state.topics) ? state.topics : [],
    predictions: Array.isArray(state.predictions) ? state.predictions : [],
    pool: {
      total: Number(state.pool?.total || 0),
      updatedAt: state.pool?.updatedAt || null,
    },
  };
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return normalizeState(JSON.parse(raw));
}

function writeDb(state) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

export function loadState() {
  return readDb();
}

export function saveState(state) {
  writeDb(state);
}

export function getSummaryForMatch(state, matchId) {
  const wagers = state.wagers.filter((w) => w.matchId === matchId);
  const totalPot = wagers.reduce((sum, w) => sum + w.amount, 0);
  const byBot = wagers.reduce((acc, w) => {
    const key = w.pickSide || w.pickBotId || "unknown";
    acc[key] = (acc[key] || 0) + w.amount;
    return acc;
  }, {});

  return {
    totalPot,
    picks: byBot,
    totalWagers: wagers.length,
  };
}
