export class Engine {
  constructor(name, { onLine = () => {}, onState = () => {} } = {}) {
    this.name = name;
    this.onLine = onLine;
    this.onState = onState;
    this.worker = null;
    this.ready = false;
    this.startPromise = null;
    this.lastEval = null;
    this.searchResolver = null;
  }

  start() {
    if (this.startPromise) return this.startPromise;

    this.onState("loading");

    this.startPromise = new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) reject(new Error(`${this.name}: startup timed out`));
      }, 15000);

      this.worker = new Worker("./stockfish-18-lite-single.js");

      this.worker.onerror = (event) => {
        const msg = event.message || "unknown worker error";
        this.onLine(`${this.name} ERROR: ${msg}`);
        this.onState("error");
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(msg));
        }
      };

      this.worker.onmessage = (event) => {
        const raw = String(event.data);
        for (const part of raw.split(/\r?\n/)) {
          const line = part.trim();
          if (!line) continue;

          this.onLine(`${this.name}: ${line}`);

          const cp = line.match(/\bscore cp (-?\d+)/);
          const mate = line.match(/\bscore mate (-?\d+)/);
          if (mate) this.lastEval = { type: "mate", value: Number(mate[1]) };
          else if (cp) this.lastEval = { type: "cp", value: Number(cp[1]) };

          if (line === "uciok") this.send("isready");

          if (line === "readyok" && !this.ready) {
            this.ready = true;
            this.onState("ready");
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              resolve();
            }
          }

          if (line.startsWith("bestmove ") && this.searchResolver) {
            const resolveMove = this.searchResolver;
            this.searchResolver = null;
            resolveMove(line.split(/\s+/)[1]);
          }
        }
      };

      this.send("uci");
    });

    return this.startPromise;
  }

  send(command) {
    if (this.worker) this.worker.postMessage(command);
  }

  async bestMove(fen, depth) {
    await this.start();
    this.send("stop");
    this.send(`position fen ${fen}`);

    const movePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.searchResolver) this.searchResolver = null;
        reject(new Error(`${this.name}: search timed out`));
      }, 30000);

      this.searchResolver = (move) => {
        clearTimeout(timeout);
        resolve(move);
      };
    });

    this.send(`go depth ${depth}`);
    return movePromise;
  }

  newGame() {
    this.send("ucinewgame");
    this.send("isready");
  }

  stop() {
    this.send("stop");
  }
}
