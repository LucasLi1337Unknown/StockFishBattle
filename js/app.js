import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
import { Engine } from "./engine.js";

const $ = s => document.querySelector(s);
const boardEl = $("#board");
const badgeEl = $("#statusBadge");
const gameStatusEl = $("#gameStatus");
const whiteStateEl = $("#whiteState");
const blackStateEl = $("#blackState");
const turnEl = $("#turnText");
const plyEl = $("#plyText");
const movesEl = $("#moves");
const logEl = $("#log");
const whiteEvalEl = $("#whiteEval");
const blackEvalEl = $("#blackEval");
const whiteDepth = $("#whiteDepth");
const blackDepth = $("#blackDepth");
const delayInput = $("#moveDelay");

const game = new Chess();
let running = false;
let thinking = false;
let flipped = false;
let lastMove = null;
let generation = 0;

const glyph = {
  wp:"♙", wn:"♘", wb:"♗", wr:"♖", wq:"♕", wk:"♔",
  bp:"♟", bn:"♞", bb:"♝", br:"♜", bq:"♛", bk:"♚"
};

function log(line) {
  const t = new Date().toLocaleTimeString();
  const arr = logEl.textContent === "Booting two engines…" ? [] : logEl.textContent.split("\n");
  arr.push(`[${t}] ${line}`);
  logEl.textContent = arr.slice(-120).join("\n");
  logEl.scrollTop = logEl.scrollHeight;
}

function stateSetter(el) {
  return state => {
    el.textContent = state === "ready" ? "Ready" : state === "loading" ? "Loading…" : state === "error" ? "Error" : state;
  };
}

const whiteEngine = new Engine("WHITE", { onLine: log, onState: stateSetter(whiteStateEl) });
const blackEngine = new Engine("BLACK", { onLine: log, onState: stateSetter(blackStateEl) });

function squareName(file, row) {
  return `${String.fromCharCode(97 + file)}${8 - row}`;
}

function render() {
  boardEl.innerHTML = "";

  for (let vr = 0; vr < 8; vr++) {
    for (let vc = 0; vc < 8; vc++) {
      const file = flipped ? 7 - vc : vc;
      const row = flipped ? 7 - vr : vr;
      const name = squareName(file, row);
      const sq = document.createElement("div");
      sq.className = `square ${(file + row) % 2 ? "light" : "dark"}`;

      if (lastMove && (lastMove.from === name || lastMove.to === name)) sq.classList.add("last");

      const piece = game.get(name);
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece";
        span.textContent = glyph[piece.color + piece.type];
        sq.appendChild(span);
      }

      if (vr === 7) {
        const c = document.createElement("span");
        c.className = "coord file";
        c.textContent = name[0];
        sq.appendChild(c);
      }
      if (vc === 0) {
        const c = document.createElement("span");
        c.className = "coord rank";
        c.textContent = name[1];
        sq.appendChild(c);
      }

      boardEl.appendChild(sq);
    }
  }

  const history = game.history();
  turnEl.textContent = game.turn() === "w" ? "White" : "Black";
  plyEl.textContent = String(history.length);

  if (!history.length) {
    movesEl.textContent = "No moves yet.";
  } else {
    const rows = [];
    for (let i = 0; i < history.length; i += 2) {
      rows.push(`${i/2 + 1}. ${history[i] || ""} ${history[i+1] || ""}`);
    }
    movesEl.textContent = rows.join("\n");
  }

  updateStatus();
}

function updateStatus() {
  if (game.isCheckmate()) {
    running = false;
    badgeEl.textContent = "GAME OVER";
    badgeEl.className = "badge ready";
    gameStatusEl.textContent = `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins.`;
  } else if (game.isDraw()) {
    running = false;
    badgeEl.textContent = "GAME OVER";
    badgeEl.className = "badge ready";
    gameStatusEl.textContent = "Draw.";
  } else if (thinking) {
    gameStatusEl.textContent = `${game.turn() === "w" ? "White" : "Black"} Stockfish is thinking…`;
  } else {
    gameStatusEl.textContent = `${game.turn() === "w" ? "White" : "Black"} to move.`;
  }
}

function evalText(engine) {
  const e = engine.lastEval;
  if (!e) return "—";
  if (e.type === "mate") return e.value > 0 ? `M${e.value}` : `-M${Math.abs(e.value)}`;
  return `${e.value >= 0 ? "+" : ""}${(e.value / 100).toFixed(2)}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function makeOneMove(myGen = generation) {
  if (thinking || game.isGameOver()) return;

  thinking = true;
  updateStatus();

  const side = game.turn();
  const engine = side === "w" ? whiteEngine : blackEngine;
  const depth = Number(side === "w" ? whiteDepth.value : blackDepth.value);

  try {
    const uci = await engine.bestMove(game.fen(), depth);
    if (myGen !== generation) return;

    if (!uci || uci === "(none)") throw new Error("Engine returned no move.");

    const from = uci.slice(0,2);
    const to = uci.slice(2,4);
    const promotion = uci[4] || undefined;
    const move = game.move({ from, to, promotion });
    if (!move) throw new Error(`Illegal engine move: ${uci}`);

    lastMove = { from, to };
    whiteEvalEl.textContent = evalText(whiteEngine);
    blackEvalEl.textContent = evalText(blackEngine);
    render();
  } catch (e) {
    running = false;
    badgeEl.textContent = "ENGINE ERROR";
    badgeEl.className = "badge error";
    gameStatusEl.textContent = e.message || String(e);
    log(e.message || String(e));
  } finally {
    thinking = false;
    updateStatus();
  }
}

async function battleLoop(myGen) {
  while (running && myGen === generation && !game.isGameOver()) {
    await makeOneMove(myGen);
    if (!running || myGen !== generation || game.isGameOver()) break;
    await sleep(Number(delayInput.value));
  }
}

async function boot() {
  try {
    await Promise.all([whiteEngine.start(), blackEngine.start()]);
    badgeEl.textContent = "BOTH ENGINES READY";
    badgeEl.className = "badge ready";
    gameStatusEl.textContent = "Ready. Press Start Battle.";
    log("Both Stockfish engines are ready.");
  } catch (e) {
    badgeEl.textContent = "ENGINE ERROR";
    badgeEl.className = "badge error";
    gameStatusEl.textContent = e.message || String(e);
    log(e.message || String(e));
  }
}

$("#startBtn").addEventListener("click", () => {
  if (running || game.isGameOver()) return;
  running = true;
  badgeEl.textContent = "BATTLE RUNNING";
  badgeEl.className = "badge running";
  battleLoop(generation);
});

$("#pauseBtn").addEventListener("click", () => {
  running = false;
  whiteEngine.stop();
  blackEngine.stop();
  badgeEl.textContent = "PAUSED";
  badgeEl.className = "badge waiting";
  updateStatus();
});

$("#stepBtn").addEventListener("click", () => {
  if (!running) makeOneMove(generation);
});

$("#resetBtn").addEventListener("click", () => {
  generation++;
  running = false;
  thinking = false;
  whiteEngine.stop();
  blackEngine.stop();
  game.reset();
  lastMove = null;
  whiteEngine.lastEval = null;
  blackEngine.lastEval = null;
  whiteEvalEl.textContent = "—";
  blackEvalEl.textContent = "—";
  whiteEngine.newGame();
  blackEngine.newGame();
  badgeEl.textContent = "BOTH ENGINES READY";
  badgeEl.className = "badge ready";
  render();
});

$("#flipBtn").addEventListener("click", () => { flipped = !flipped; render(); });
$("#clearLogBtn").addEventListener("click", () => { logEl.textContent = ""; });

$("#copyPgnBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(game.pgn());
    $("#copyPgnBtn").textContent = "Copied!";
    setTimeout(() => $("#copyPgnBtn").textContent = "Copy PGN", 1000);
  } catch {
    log("Could not copy PGN.");
  }
});

function bindRange(input, output, format = v => v) {
  const update = () => output.textContent = format(input.value);
  input.addEventListener("input", update);
  update();
}
bindRange(whiteDepth, $("#whiteDepthValue"));
bindRange(blackDepth, $("#blackDepthValue"));
bindRange(delayInput, $("#delayValue"), v => `${v} ms`);

render();
boot();
