# OpenWhisper Web

Open-source AI voice dictation web app. Speak naturally, get polished text.

An open-source alternative to [Wispr Flow](https://wisprflow.ai/).

## Features

- **Push-to-talk dictation** — Hold a key or click the mic, speak, release to transcribe
- **Dual STT engines** — Groq Whisper API (fast cloud) or self-hosted Whisper (private)
- **AI post-processing** — Removes filler words, fixes grammar, adjusts tone
- **Multiple AI providers** — Groq (free), OpenAI, or Ollama (local)
- **Tone control** — Auto, casual, professional, or technical
- **Personal dictionary** — Custom words/names for better accuracy
- **Transcription history** — Browse and copy past dictations
- **100+ languages** — Auto-detection or manual selection

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and add your Groq API key (free at console.groq.com)
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

```
Microphone → Web Audio API → Audio Blob
                                 ↓
                          Groq Whisper API  (or self-hosted)
                                 ↓
                            Raw Text
                                 ↓
                          AI Post-Processing  (Groq/OpenAI/Ollama)
                                 ↓
                          Cleaned Text → Display + History
```

## Self-Hosted Whisper Server

For fully private transcription, run a local Whisper server:

```bash
# Option 1: faster-whisper-server
pip install faster-whisper-server
faster-whisper-server --model base --host 0.0.0.0 --port 8000

# Option 2: Docker
docker run -p 8000:8000 fedirz/faster-whisper-server
```

Then set the STT engine to "Self-hosted" in Settings and point it to `http://localhost:8000`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **State:** Zustand
- **STT:** Groq Whisper API / faster-whisper
- **AI:** Groq (Llama 3.3) / OpenAI / Ollama
- **Audio:** Web Audio API + MediaRecorder

## Deploy

```bash
npm run build
npm start
```

Or deploy to Vercel with one click.

## License

MIT
