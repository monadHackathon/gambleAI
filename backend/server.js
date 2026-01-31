import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { loadState, saveState, getSummaryForMatch } from "./store.js";

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const MONAD_WEBHOOK_URL = process.env.MONAD_WEBHOOK_URL || "";
const MONAD_API_KEY = process.env.MONAD_API_KEY || "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "";
const MONAD_CHAIN_ID = process.env.MONAD_CHAIN_ID || "10143";
const MONAD_AUTO_ANCHOR = process.env.MONAD_AUTO_ANCHOR === "true";
const CLAWDBOT_WEBHOOK_URL = process.env.CLAWDBOT_WEBHOOK_URL || "";
const CLAWDBOT_API_KEY = process.env.CLAWDBOT_API_KEY || "";
const FRONTEND_PATH =
  process.env.FRONTEND_PATH || path.resolve(process.cwd(), "..", "frontend");

const AI_BOTS = [
  { id: "monad-scout", name: "Monad Scout" },
  { id: "clawdbot-oracle", name: "ClawDBot Oracle" },
  { id: "macro-weaver", name: "Macro Weaver" },
  { id: "liquidity-fox", name: "Liquidity Fox" },
];

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(FRONTEND_PATH));

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(403).json({ error: "Admin token not set" });
  }
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Invalid admin token" });
  }
  return next();
}

function getBot(state, id) {
  return state.bots.find((bot) => bot.id === id);
}

function ensureDefaultBots(state) {
  const createdAt = new Date().toISOString();
  const defaults = [
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "OpenAI",
      model: "gpt-4-turbo",
      category: "Metin Tabanlı Dövüşçüler",
      tag: "Mantık ve akıl yürütme şampiyonu",
    },
    {
      id: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      provider: "Anthropic",
      model: "claude-3-5-sonnet",
      category: "Metin Tabanlı Dövüşçüler",
      tag: "Kodlama ve insani nüanslarda uzman",
    },
    {
      id: "gemini-1-5-pro",
      name: "Gemini 1.5 Pro",
      provider: "Google",
      model: "gemini-1-5-pro",
      category: "Görsel Tabanlı Dövüşçüler",
      tag: "Çok büyük veri işleme kapasitesi",
    },
    {
      id: "llama-3",
      name: "Llama 3",
      provider: "Meta",
      model: "llama-3",
      category: "Metin Tabanlı Dövüşçüler",
      tag: "Açık kaynağın en güçlü temsilcisi",
    },
    {
      id: "midjourney-v6",
      name: "Midjourney v6",
      provider: "Midjourney",
      model: "midjourney-v6",
      category: "Görsel Tabanlı Dövüşçüler",
      tag: "Estetik ve yaratıcılık lideri",
    },
    {
      id: "dalle-3",
      name: "DALL·E 3",
      provider: "OpenAI",
      model: "dall-e-3",
      category: "Görsel Tabanlı Dövüşçüler",
      tag: "Prompt sadakati yüksek görsel sanatçı",
    },
  ];

  defaults.forEach((bot) => {
    if (!getBot(state, bot.id)) {
      state.bots.push({
        ...bot,
        owner: "system",
        createdAt,
      });
    }
  });
}

function getMatch(state, id) {
  return state.matches.find((match) => match.id === id);
}

function computePayouts(state, match, outcome) {
  if (!outcome) return [];
  const wagers = state.wagers.filter((w) => w.matchId === match.id);
  const winners = wagers.filter((w) => (w.pickSide || w.pickBotId) === outcome);
  const totalPot = wagers.reduce((sum, w) => sum + w.amount, 0);
  const totalWin = winners.reduce((sum, w) => sum + w.amount, 0);
  if (!totalPot || !totalWin) return [];
  return winners.map((w) => ({
    bettor: w.bettor,
    amount: Number(((w.amount / totalWin) * totalPot).toFixed(4)),
  }));
}

function getTopic(state, id) {
  return state.topics.find((topic) => topic.id === id);
}

function getTopicSummary(state, topicId) {
  const wagers = state.wagers.filter((w) => w.topicId === topicId);
  const totalPot = wagers.reduce((sum, w) => sum + w.amount, 0);
  const byPick = wagers.reduce((acc, w) => {
    acc[w.pick] = (acc[w.pick] || 0) + w.amount;
    return acc;
  }, {});
  return {
    totalPot,
    picks: byPick,
    totalWagers: wagers.length,
  };
}

async function postJson(url, payload, apiKey) {
  if (!url) return { ok: false, skipped: true };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function notifyIntegrations(eventType, payload) {
  const [monad, clawdbot] = await Promise.all([
    postJson(MONAD_WEBHOOK_URL, { eventType, payload }, MONAD_API_KEY),
    postJson(CLAWDBOT_WEBHOOK_URL, { eventType, payload }, CLAWDBOT_API_KEY),
  ]);
  return { monad, clawdbot };
}

function generatePredictions(topicId, prompt) {
  return AI_BOTS.map((bot) => {
    const pick = Math.random() > 0.5 ? "up" : "down";
    const confidence = Math.floor(50 + Math.random() * 45);
    return {
      id: nanoid(10),
      topicId,
      botId: bot.id,
      botName: bot.name,
      pick,
      confidence,
      reason: `${prompt.slice(0, 60)}...`,
      createdAt: new Date().toISOString(),
    };
  });
}

function createMonadAnchor(match) {
  const payload = {
    matchId: match.id,
    botAId: match.botAId,
    botBId: match.botBId,
    winnerBotId: match.winnerBotId,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    endedAt: match.endedAt,
  };
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const txHash = `0x${payloadHash}`;
  return {
    chainId: MONAD_CHAIN_ID,
    payloadHash,
    txHash,
    anchoredAt: new Date().toISOString(),
    rpcConfigured: Boolean(MONAD_RPC_URL),
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gambleAI", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.sendFile(path.resolve(FRONTEND_PATH, "index.html"));
});

app.get("/ring/:id", (req, res) => {
  res.sendFile(path.resolve(FRONTEND_PATH, "ring.html"));
});

app.get("/ring", (req, res) => {
  res.sendFile(path.resolve(FRONTEND_PATH, "ring.html"));
});

app.get("/api/integrations/status", (req, res) => {
  res.json({
    monad: { configured: Boolean(MONAD_WEBHOOK_URL) },
    clawdbot: { configured: Boolean(CLAWDBOT_WEBHOOK_URL) },
  });
});

app.get("/api/monad/status", (req, res) => {
  res.json({
    configured: Boolean(MONAD_RPC_URL),
    chainId: MONAD_CHAIN_ID,
    autoAnchor: MONAD_AUTO_ANCHOR,
  });
});

app.get("/api/ai/bots", (req, res) => {
  res.json(AI_BOTS);
});

app.get("/api/topics", (req, res) => {
  const state = loadState();
  const topics = state.topics.map((topic) => ({
    ...topic,
    summary: getTopicSummary(state, topic.id),
  }));
  res.json(topics);
});

app.post("/api/topics", (req, res) => {
  const { prompt, createdBy } = req.body;
  if (!prompt || prompt.length < 6) {
    return res.status(400).json({ error: "prompt is required" });
  }
  const state = loadState();
  const topic = {
    id: nanoid(10),
    prompt,
    createdBy: createdBy || "anon",
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    outcome: null,
  };
  state.topics.unshift(topic);
  const predictions = generatePredictions(topic.id, prompt);
  state.predictions.push(...predictions);
  saveState(state);
  res.status(201).json({ topic, predictions });
});

app.get("/api/topics/:id", (req, res) => {
  const state = loadState();
  const topic = getTopic(state, req.params.id);
  if (!topic) {
    return res.status(404).json({ error: "Topic not found" });
  }
  const predictions = state.predictions.filter((p) => p.topicId === topic.id);
  const wagers = state.wagers.filter((w) => w.topicId === topic.id);
  res.json({
    ...topic,
    summary: getTopicSummary(state, topic.id),
    predictions,
    wagers,
  });
});

app.post("/api/topics/:id/wagers", (req, res) => {
  const { bettorWallet, amount, pick } = req.body;
  if (!bettorWallet || !amount || !pick) {
    return res.status(400).json({ error: "bettorWallet, amount, pick required" });
  }
  const state = loadState();
  const topic = getTopic(state, req.params.id);
  if (!topic) {
    return res.status(404).json({ error: "Topic not found" });
  }
  if (topic.status !== "open") {
    return res.status(400).json({ error: "Topic not open" });
  }
  if (!["up", "down"].includes(pick)) {
    return res.status(400).json({ error: "pick must be up or down" });
  }
  const wager = {
    id: nanoid(10),
    topicId: topic.id,
    bettorWallet,
    amount: Number(amount),
    pick,
    createdAt: new Date().toISOString(),
  };
  state.wagers.push(wager);
  saveState(state);
  res.status(201).json(wager);
});

app.post("/api/topics/:id/resolve", requireAdmin, (req, res) => {
  const { outcome } = req.body;
  if (!["up", "down"].includes(outcome)) {
    return res.status(400).json({ error: "outcome must be up or down" });
  }
  const state = loadState();
  const topic = getTopic(state, req.params.id);
  if (!topic) {
    return res.status(404).json({ error: "Topic not found" });
  }
  if (topic.status !== "open") {
    return res.status(400).json({ error: "Topic already resolved" });
  }
  topic.status = "resolved";
  topic.outcome = outcome;
  topic.resolvedAt = new Date().toISOString();
  const wagers = state.wagers.filter((w) => w.topicId === topic.id);
  const totalPot = wagers.reduce((sum, w) => sum + w.amount, 0);
  const winners = wagers.filter((w) => w.pick === outcome);
  const totalWinning = winners.reduce((sum, w) => sum + w.amount, 0) || 1;
  const payouts = winners.map((w) => ({
    bettorWallet: w.bettorWallet,
    amount: Number(((w.amount / totalWinning) * totalPot).toFixed(4)),
  }));
  saveState(state);
  res.json({ topic, totalPot, payouts });
});

app.get("/api/bots", (req, res) => {
  const state = loadState();
  ensureDefaultBots(state);
  saveState(state);
  res.json(state.bots);
});

app.post("/api/bots", (req, res) => {
  const { name, model, owner } = req.body;
  if (!name || !model) {
    return res.status(400).json({ error: "name and model required" });
  }
  const state = loadState();
  const bot = {
    id: nanoid(10),
    name,
    model,
    owner: owner || "anon",
    createdAt: new Date().toISOString(),
  };
  state.bots.push(bot);
  saveState(state);
  res.status(201).json(bot);
});

app.get("/api/matches", (req, res) => {
  const { status } = req.query;
  const state = loadState();
  let matches = state.matches;
  if (status) {
    matches = matches.filter((match) => match.status === status);
  }
  const enriched = matches.map((match) => ({
    ...match,
    summary: getSummaryForMatch(state, match.id),
  }));
  res.json(enriched);
});

app.get("/api/pool", (req, res) => {
  const state = loadState();
  res.json({ total: state.pool?.total || 0, updatedAt: state.pool?.updatedAt || null });
});

app.get("/api/matches/:id", (req, res) => {
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  res.json({ ...match, summary: getSummaryForMatch(state, match.id) });
});

app.post("/api/matches", (req, res) => {
  const { botAId, botBId, scheduledAt, prompt } = req.body;
  const state = loadState();
  ensureDefaultBots(state);
  const finalBotAId = botAId || "ai-alpha";
  const finalBotBId = botBId || "ai-beta";
  if (!getBot(state, finalBotAId) || !getBot(state, finalBotBId)) {
    return res.status(400).json({ error: "Bot not found" });
  }
  const match = {
    id: nanoid(10),
    botAId: finalBotAId,
    botBId: finalBotBId,
    prompt: prompt || null,
    options: ["yes", "no"],
    status: "scheduled",
    createdAt: new Date().toISOString(),
    scheduledAt: scheduledAt || new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    scoreA: null,
    scoreB: null,
    winnerBotId: null,
  };
  state.matches.push(match);
  saveState(state);
  res.status(201).json(match);
});

app.post("/api/matches/:id/start", requireAdmin, async (req, res) => {
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  if (match.status !== "scheduled") {
    return res.status(400).json({ error: "Match not scheduled" });
  }
  match.status = "live";
  match.startedAt = new Date().toISOString();
  saveState(state);
  const integrations = await notifyIntegrations("match.started", match);
  res.json({ ...match, integrations });
});

app.post("/api/matches/:id/resolve", requireAdmin, async (req, res) => {
  const { winnerBotId, scoreA, scoreB, outcome } = req.body;
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  if (match.status === "completed") {
    return res.status(400).json({ error: "Match already completed" });
  }
  if (winnerBotId && winnerBotId !== match.botAId && winnerBotId !== match.botBId) {
    return res.status(400).json({ error: "Winner must be botAId or botBId" });
  }
  match.status = "completed";
  match.endedAt = new Date().toISOString();
  match.scoreA = typeof scoreA === "number" ? scoreA : null;
  match.scoreB = typeof scoreB === "number" ? scoreB : null;
  match.winnerBotId = winnerBotId || null;
  if (outcome && !["yes", "no"].includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be yes or no" });
  }
  match.outcome = outcome || match.outcome || null;
  if (match.outcome) {
    match.payouts = computePayouts(state, match, match.outcome);
  }
  if (MONAD_AUTO_ANCHOR) {
    match.monad = createMonadAnchor(match);
  }
  saveState(state);
  const integrations = await notifyIntegrations("match.completed", match);
  res.json({ ...match, integrations });
});

app.post("/api/matches/:id/simulate", requireAdmin, async (req, res) => {
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  if (match.status === "completed") {
    return res.status(400).json({ error: "Match already completed" });
  }
  const scoreA = Math.floor(40 + Math.random() * 40);
  const scoreB = Math.floor(40 + Math.random() * 40);
  match.status = "completed";
  match.startedAt = match.startedAt || new Date().toISOString();
  match.endedAt = new Date().toISOString();
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerBotId = scoreA >= scoreB ? match.botAId : match.botBId;
  match.outcome = Math.random() > 0.5 ? "yes" : "no";
  match.payouts = computePayouts(state, match, match.outcome);
  if (MONAD_AUTO_ANCHOR) {
    match.monad = createMonadAnchor(match);
  }
  saveState(state);
  const integrations = await notifyIntegrations("match.simulated", match);
  res.json({ ...match, integrations });
});

app.post("/api/matches/:id/anchor", requireAdmin, async (req, res) => {
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  if (match.status !== "completed") {
    return res.status(400).json({ error: "Match must be completed" });
  }
  match.monad = createMonadAnchor(match);
  saveState(state);
  const integrations = await notifyIntegrations("match.anchored", match);
  res.json({ ...match, integrations });
});

app.post("/api/wagers", async (req, res) => {
  const { matchId, bettor, amount, pickBotId, pickSide } = req.body;
  if (!matchId || !bettor || !amount) {
    return res.status(400).json({ error: "matchId, bettor, amount required" });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: "amount must be positive" });
  }
  const state = loadState();
  const match = getMatch(state, matchId);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  if (match.status === "completed") {
    return res.status(400).json({ error: "Match already completed" });
  }
  const finalPick = pickSide || pickBotId;
  if (!finalPick) {
    return res.status(400).json({ error: "pickSide or pickBotId required" });
  }
  const allowedSides = match.options || [];
  if (
    finalPick !== match.botAId &&
    finalPick !== match.botBId &&
    (allowedSides.length ? !allowedSides.includes(finalPick) : true)
  ) {
    return res.status(400).json({ error: "Invalid pick" });
  }
  const wager = {
    id: nanoid(10),
    matchId,
    bettor,
    amount: Number(amount),
    pickBotId: pickBotId || null,
    pickSide: pickSide || null,
    createdAt: new Date().toISOString(),
  };
  state.wagers.push(wager);
  state.pool = {
    total: (state.pool?.total || 0) + wager.amount,
    updatedAt: new Date().toISOString(),
  };
  saveState(state);
  const integrations = await notifyIntegrations("wager.created", wager);
  res.status(201).json({ ...wager, integrations });
});

app.get("/api/matches/:id/wagers", (req, res) => {
  const state = loadState();
  const match = getMatch(state, req.params.id);
  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }
  const wagers = state.wagers.filter((w) => w.matchId === match.id);
  res.json(wagers);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
