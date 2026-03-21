# OpenWhisper Backend

Self-hosted Python backend for OpenWhisper. Runs local Whisper transcription + AI post-processing.

## Quick Start

```bash
# Install
pip install -e .

# Set up env
cp .env.example .env
# Edit .env with your API keys

# Run
uvicorn app.main:app --reload
```

Server starts at `http://localhost:8000`.

## Docker

```bash
docker build -t openwhisper-backend .
docker run -p 8000:8000 --env-file .env openwhisper-backend
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/audio/transcriptions` | POST | Transcribe audio (OpenAI-compatible) |
| `/v1/process` | POST | AI post-processing (cleanup, grammar, tone) |
| `/v1/command` | POST | Command Mode (text transformation) |
| `/health` | GET | Health check |
| `/docs` | GET | Interactive API docs (Swagger) |

## Connecting to the Frontend

In the OpenWhisper web app Settings, set:
- **STT Engine:** Self-hosted
- **Server URL:** `http://localhost:8000`

The backend's `/v1/audio/transcriptions` endpoint is compatible with OpenAI's Whisper API format, so the frontend uses the same code for both Groq and self-hosted modes.

## Configuration

All settings via environment variables (prefix `OPENWHISPER_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWHISPER_WHISPER_MODEL` | `base` | Whisper model size |
| `OPENWHISPER_WHISPER_DEVICE` | `auto` | Device (auto/cpu/cuda) |
| `OPENWHISPER_GROQ_API_KEY` | - | Groq API key for AI |
| `OPENWHISPER_OPENAI_API_KEY` | - | OpenAI API key |
| `OPENWHISPER_OLLAMA_URL` | `http://localhost:11434` | Ollama URL |
| `OPENWHISPER_PORT` | `8000` | Server port |
