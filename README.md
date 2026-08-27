# Stockfish vs Stockfish

Two independent Stockfish 18 Lite WASM engines play against each other automatically in the browser.

## IMPORTANT

Copy these two already-working files from your Test002Stockfish project into the ROOT of this new repo:

```text
stockfish-18-lite-single.js
stockfish-18-lite-single.wasm
```

Final structure:

```text
StockfishVsStockfish/
├── index.html
├── stockfish-18-lite-single.js
├── stockfish-18-lite-single.wasm
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── engine.js
└── README.md
```

Do NOT edit the `.wasm` file in GitHub's text editor. Upload the original binary file.

## Features

- Stockfish vs Stockfish autoplay
- Separate White and Black engine workers
- Adjustable search depth for both sides
- Adjustable move delay
- Start / Pause
- One Move button
- New Game
- Flip Board
- Legal chess via chess.js
- Checkmate and draw detection
- Move history / PGN
- Engine logs
