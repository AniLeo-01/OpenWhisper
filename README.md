# OpenWhisper

Open-source AI voice dictation. Speak naturally, get polished text — filler words removed, grammar fixed, tone adjusted automatically. An open-source alternative to [Wispr Flow](https://wisprflow.ai/).

---

## How It Works

OpenWhisper follows the same core flow as Wispr Flow:

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                        USER INTERACTION                         │
 │                                                                 │
 │   1. Hold Ctrl ─────► Flow Bar activates (waveform animates)   │
 │   2. Speak naturally  "schedule a call with the design team     │
 │                        um next Tuesday at 3pm no wait 4pm"      │
 │   3. Release Ctrl ──► Flow Bar shows "Transcribing..."         │
 └────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │                    STEP 1: SPEECH-TO-TEXT                        │
 │                                                                 │
 │   Audio blob (WebM/Opus) ──► Groq Whisper API  (cloud, <1s)   │
 │                          or  Self-hosted faster-whisper (local) │
 │                                                                 │
 │   Raw output: "schedule a call with the design team um next     │
 │                Tuesday at 3pm no wait 4pm"                      │
 └────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │                  STEP 2: AI POST-PROCESSING                     │
 │                                                                 │
 │   LLM (Groq Llama 3.3 / OpenAI / Ollama) applies:             │
 │                                                                 │
 │   ✓ Filler removal ─── "um" removed                            │
 │   ✓ Self-correction ── "3pm no wait 4pm" → "4pm"              │
 │   ✓ Grammar fix ────── punctuation, capitalization              │
 │   ✓ Tone adjustment ── casual/professional/technical            │
 │                                                                 │
 │   Clean output: "Schedule a call with the design team next      │
 │                  Tuesday at 4pm."                               │
 └────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │                   STEP 3: TEXT INSERTION                         │
 │                                                                 │
 │   Cleaned text appears in the editor with a typing animation.  │
 │   User can copy to clipboard or continue dictating to append.  │
 │   Entry is saved to history for later retrieval.               │
 └─────────────────────────────────────────────────────────────────┘
```

### Command Mode

Select any text in the editor, then click "Command Mode" (or press Ctrl+Shift). Speak a transformation command — the selected text gets replaced:

```
 Selected: "We need to finalize the Q3 budget report and send it to stakeholders"
 Command:  "make it more urgent and add a deadline"
 Result:   "We must finalize the Q3 budget report and distribute it to all
            stakeholders by end of day Friday."
```

Examples of voice commands: "make this more concise", "translate to Spanish", "rewrite as bullet points", "make it sound more professional", "simplify for a general audience".

---

## Architecture

```
openwhisper/
├── web/                    ← Next.js 16 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                 # Main dictation page (Flow Bar + Text Editor)
│   │   │   ├── settings/page.tsx        # Settings (STT engine, AI provider, dictionary)
│   │   │   ├── history/page.tsx         # Full history page
│   │   │   └── api/
│   │   │       ├── transcribe/route.ts  # STT proxy (Groq or self-hosted)
│   │   │       ├── process/route.ts     # AI post-processing
│   │   │       └── command/route.ts     # Command Mode transformations
│   │   ├── components/
│   │   │   ├── FlowBar.tsx              # Floating pill bar (idle/recording/processing)
│   │   │   ├── TextEditor.tsx           # Main text area with typing animation
│   │   │   ├── HistoryPanel.tsx         # Slide-in history drawer
│   │   │   └── OnboardingModal.tsx      # First-run setup wizard
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts      # Web Audio API recording + level metering
│   │   │   └── useHotkey.ts             # Push-to-talk keyboard listener
│   │   └── lib/
│   │       ├── store.ts                 # Zustand state (settings, history)
│   │       └── transcribe.ts            # Dictation pipeline orchestrator
│   └── package.json
│
├── backend/                ← Python/FastAPI backend (optional, for self-hosted mode)
│   ├── app/
│   │   ├── main.py                      # FastAPI app with lifespan + CORS
│   │   ├── config.py                    # Pydantic settings (env vars)
│   │   ├── routers/
│   │   │   ├── transcribe.py            # /v1/audio/transcriptions (OpenAI-compatible)
│   │   │   └── process.py               # /v1/process + /v1/command
│   │   ├── services/
│   │   │   ├── whisper.py               # faster-whisper with lazy model loading
│   │   │   └── ai.py                    # LLM providers (Groq/OpenAI/Ollama)
│   │   └── models/
│   │       └── schemas.py               # Pydantic request/response models
│   ├── Dockerfile
│   └── pyproject.toml
│
└── IMPLEMENTATION_PLAN.md  ← Full roadmap for desktop + mobile versions
```

---

## Quick Start

### Frontend only (Groq cloud — fastest setup)

```bash
cd web
npm install
cp .env.example .env.local
# Add your free Groq API key from https://console.groq.com
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Hold **Ctrl** and speak.

### With self-hosted backend (fully private, no data leaves your machine)

```bash
# Terminal 1: Start the backend
cd backend
pip install -e .
cp .env.example .env
# Edit .env — set OPENWHISPER_WHISPER_MODEL=base (or small/medium/large-v3)
uvicorn app.main:app --reload

# Terminal 2: Start the frontend
cd web
npm run dev
```

In the web app, go to **Settings → STT Engine → Self-hosted** and set the URL to `http://localhost:8000`.

### Docker (backend)

```bash
cd backend
docker build -t openwhisper-backend .
docker run -p 8000:8000 --env-file .env openwhisper-backend
```

---

## Features

### Core Dictation
- **Hold-to-talk** — Hold Ctrl, speak, release. Text appears with a typing animation.
- **Hands-free mode** — Click the Flow Bar to toggle continuous listening.
- **Flow Bar** — Floating pill at the bottom: idle → recording waveform → processing spinner. Minimal, stays out of the way.

### AI Processing
- **Filler removal** — Strips "um", "uh", "like", "you know", "basically", "I mean"
- **Self-correction handling** — "meet Tuesday, wait no, Wednesday" → outputs only "Wednesday"
- **Grammar & punctuation** — Fixes capitalization, adds proper punctuation
- **Tone adjustment** — Auto, casual, professional, or technical modes

### Command Mode
- Select text → speak a command → text gets transformed
- "make this more concise", "translate to French", "rewrite as bullet points"
- Powered by the same AI providers (Groq/OpenAI/Ollama)

### Personalization
- **Personal dictionary** — Add names, jargon, acronyms for accurate transcription
- **100+ languages** — Auto-detection or manual selection
- **Multiple AI providers** — Groq (free + fast), OpenAI, Ollama (fully local)

### Privacy
- **Self-hosted option** — Run faster-whisper locally, no audio leaves your machine
- **No accounts required** — Settings stored in localStorage, no server-side user data
- **Open source** — Audit every line of code

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4 | App Router, API routes, fast builds |
| State | Zustand | Lightweight, no boilerplate |
| Audio | Web Audio API + MediaRecorder | Browser-native, low-latency |
| Cloud STT | Groq Whisper API | Sub-second latency, free tier (14,400 req/day) |
| Local STT | faster-whisper (CTranslate2) | 4× faster than OpenAI Whisper, lower memory |
| AI cleanup | Groq (Llama 3.3) / OpenAI / Ollama | Filler removal, grammar, tone |
| Backend | FastAPI, Python 3.11+ | Async, OpenAI-compatible API |
| Icons | Lucide React | Clean, consistent icon set |

---

## Configuration

### Frontend (web/.env.local)

Settings are managed in the UI (Settings page), but you can also set defaults:

```env
NEXT_PUBLIC_GROQ_API_KEY=gsk_...
NEXT_PUBLIC_WHISPER_SERVER_URL=http://localhost:8000
```

### Backend (backend/.env)

All settings use the `OPENWHISPER_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWHISPER_WHISPER_MODEL` | `base` | Model size: tiny, base, small, medium, large-v3 |
| `OPENWHISPER_WHISPER_DEVICE` | `auto` | Device: auto, cpu, cuda |
| `OPENWHISPER_GROQ_API_KEY` | — | For AI post-processing |
| `OPENWHISPER_PORT` | `8000` | Server port |

---

## Roadmap

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full roadmap including:
- Desktop app (Tauri + Python) with global hotkey + paste-to-any-app
- Chrome extension for dictation in any text field
- Mobile companion apps (iOS/Android)
- Plugin system for custom STT backends and AI providers
- Voice-triggered snippets (say "insert email signature" → expands to full block)

---

## Contributing

Contributions are welcome! This project has two main areas:

### Frontend (web/)
The entire frontend was built with AI assistance (Claude). If you're comfortable with React/Next.js/TypeScript, areas that need help include:
- Improving the Flow Bar animations and responsiveness
- Adding real-time streaming transcription (show words as they're spoken)
- Building the Chrome extension for dictation in any web text field
- Accessibility improvements (screen reader support, keyboard navigation)
- Mobile-responsive design refinements
- E2E tests with Playwright

### Backend (backend/)
The Python backend powers self-hosted mode:
- Adding streaming Whisper transcription (word-by-word output)
- Supporting more STT models (Parakeet, Canary, etc.)
- WebSocket support for real-time audio streaming
- Improving audio preprocessing (noise reduction, VAD)
- GPU optimization and model quantization
- Load testing and performance benchmarking

### Getting started as a contributor

```bash
# Fork and clone
git clone https://github.com/your-username/openwhisper.git
cd openwhisper

# Frontend
cd web && npm install && npm run dev

# Backend
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload

# Run checks
cd web && npm run build          # TypeScript + build check
cd backend && ruff check app/    # Python linting
```

Please open an issue before starting work on major features so we can coordinate.

---

## Acknowledgments

This project was built with assistance from [Claude](https://claude.ai) (Anthropic) for the frontend architecture, component design, and API layer. The project maintainer ([@aniruddha](https://github.com/aniruddha)) focuses on the backend, AI pipeline, and infrastructure.

Key open-source projects this builds on:
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2-optimized Whisper
- [Groq](https://groq.com) — Ultra-fast LLM and Whisper inference
- [Next.js](https://nextjs.org) — React framework
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [FastAPI](https://fastapi.tiangolo.com) — Python API framework

---

## License

MIT
