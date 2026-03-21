# OpenWhisper — Implementation Plan

**Open-source AI voice dictation that works everywhere**

An open-source alternative to Wispr Flow, built with Python. Supports fully offline transcription via Whisper and ultra-fast cloud transcription via Groq, with AI post-processing for filler removal, grammar correction, and tone adjustment.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OpenWhisper Core                      │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Audio    │→ │  STT Engine  │→ │  AI Post-Process  │  │
│  │  Capture  │  │  (Whisper /  │  │  (LLM cleanup,    │  │
│  │  Module   │  │   Groq API)  │  │   formatting)     │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│       ↑                                    ↓            │
│  ┌──────────┐                     ┌───────────────────┐  │
│  │  Hotkey   │                     │  Text Injection   │  │
│  │  Listener │                     │  (paste to any    │  │
│  │  (global) │                     │   active app)     │  │
│  └──────────┘                     └───────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              System Tray UI + Settings            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Language** | Python 3.11+ | Rich ML ecosystem, fast prototyping, cross-platform |
| **Desktop UI** | System tray (`pystray`) + settings window (`PySide6` or `customtkinter`) | Lightweight, stays out of the way |
| **Audio capture** | `sounddevice` (PortAudio bindings) | Cross-platform, low-latency, supports all OS audio APIs |
| **Local STT** | `faster-whisper` (CTranslate2-optimized Whisper) | 4× faster than OpenAI Whisper, lower memory, same accuracy |
| **Cloud STT** | Groq Whisper API | Near-realtime (<1s latency), free tier available |
| **AI post-processing** | Groq (Llama 3) / Ollama (local) / OpenAI API | Filler removal, grammar, tone adjustment |
| **Global hotkey** | `pynput` | Cross-platform keyboard listener |
| **Text injection** | `pyperclip` + platform-native paste simulation | Works in any app via clipboard + Ctrl/Cmd+V |
| **Packaging** | `PyInstaller` (desktop), `Kivy`/`BeeWare` (mobile) | Native installers for each platform |
| **Config** | TOML files (`tomli`/`tomli-w`) | Human-readable, easy to edit |

---

## Project Structure

```
openwhisper/
├── README.md
├── pyproject.toml                 # Project metadata, dependencies
├── LICENSE                        # MIT or Apache 2.0
│
├── src/
│   └── openwhisper/
│       ├── __init__.py
│       ├── main.py                # Entry point, orchestration
│       ├── config.py              # Settings management (TOML)
│       │
│       ├── audio/
│       │   ├── __init__.py
│       │   ├── recorder.py        # Microphone capture (sounddevice)
│       │   ├── vad.py             # Voice Activity Detection (silero-vad)
│       │   └── processor.py       # Audio preprocessing (noise gate, normalization)
│       │
│       ├── stt/
│       │   ├── __init__.py
│       │   ├── base.py            # Abstract STT engine interface
│       │   ├── whisper_local.py   # faster-whisper local transcription
│       │   ├── groq_cloud.py      # Groq Whisper API client
│       │   └── engine.py          # Engine selector (local/cloud/auto)
│       │
│       ├── ai/
│       │   ├── __init__.py
│       │   ├── postprocessor.py   # Filler removal, grammar, formatting
│       │   ├── tone.py            # Context-aware tone adjustment
│       │   ├── commands.py        # Voice command parser ("select all", "new line")
│       │   └── providers/
│       │       ├── groq.py        # Groq LLM provider
│       │       ├── ollama.py      # Ollama local LLM provider
│       │       └── openai.py      # OpenAI API provider
│       │
│       ├── injection/
│       │   ├── __init__.py
│       │   ├── injector.py        # Cross-platform text injection
│       │   ├── macos.py           # macOS-specific (AppleScript / CGEvent)
│       │   ├── windows.py         # Windows-specific (SendInput / pywinauto)
│       │   └── linux.py           # Linux-specific (xdotool / ydotool for Wayland)
│       │
│       ├── hotkey/
│       │   ├── __init__.py
│       │   └── listener.py        # Global hotkey registration + push-to-talk
│       │
│       ├── ui/
│       │   ├── __init__.py
│       │   ├── tray.py            # System tray icon + menu (pystray)
│       │   ├── settings.py        # Settings window (PySide6)
│       │   ├── overlay.py         # Floating transcription indicator
│       │   └── assets/            # Icons, images
│       │
│       ├── features/
│       │   ├── __init__.py
│       │   ├── dictionary.py      # Personal dictionary (custom words/names)
│       │   ├── snippets.py        # Voice-triggered text snippets
│       │   └── history.py         # Transcription history log
│       │
│       └── utils/
│           ├── __init__.py
│           ├── platform.py        # OS detection + platform-specific helpers
│           └── logger.py          # Structured logging
│
├── tests/
│   ├── test_audio.py
│   ├── test_stt.py
│   ├── test_postprocessor.py
│   └── test_injection.py
│
├── scripts/
│   ├── build_macos.sh
│   ├── build_windows.ps1
│   └── build_linux.sh
│
└── assets/
    ├── icon.png
    ├── icon.ico
    └── icon.icns
```

---

## Phase 1 — MVP Core (Weeks 1–3)

The MVP gets a single thing right: **hold a key, speak, release, and polished text appears wherever your cursor is.**

### 1.1 Audio Capture Module

```python
# src/openwhisper/audio/recorder.py
import sounddevice as sd
import numpy as np
from collections import deque

class AudioRecorder:
    """Records audio from the default microphone while hotkey is held."""

    def __init__(self, sample_rate=16000, channels=1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.buffer = deque()
        self.is_recording = False

    def start(self):
        self.buffer.clear()
        self.is_recording = True
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype="float32",
            callback=self._callback,
        )
        self.stream.start()

    def stop(self) -> np.ndarray:
        self.is_recording = False
        self.stream.stop()
        self.stream.close()
        return np.concatenate(list(self.buffer))

    def _callback(self, indata, frames, time, status):
        if self.is_recording:
            self.buffer.append(indata.copy().flatten())
```

### 1.2 STT Engine (Dual Mode)

```python
# src/openwhisper/stt/base.py
from abc import ABC, abstractmethod

class STTEngine(ABC):
    @abstractmethod
    def transcribe(self, audio: np.ndarray, language: str = None) -> str:
        """Transcribe audio array to text."""
        pass

# src/openwhisper/stt/whisper_local.py
from faster_whisper import WhisperModel

class LocalWhisperEngine(STTEngine):
    def __init__(self, model_size="base", device="auto"):
        self.model = WhisperModel(model_size, device=device, compute_type="auto")

    def transcribe(self, audio, language=None):
        segments, _ = self.model.transcribe(audio, language=language)
        return " ".join(seg.text for seg in segments).strip()

# src/openwhisper/stt/groq_cloud.py
import httpx, io, soundfile as sf

class GroqWhisperEngine(STTEngine):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.groq.com/openai/v1/audio/transcriptions"

    def transcribe(self, audio, language=None):
        buf = io.BytesIO()
        sf.write(buf, audio, 16000, format="WAV")
        buf.seek(0)
        resp = httpx.post(
            self.url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            files={"file": ("audio.wav", buf, "audio/wav")},
            data={"model": "whisper-large-v3", "language": language or ""},
        )
        return resp.json()["text"]
```

### 1.3 AI Post-Processing

```python
# src/openwhisper/ai/postprocessor.py

CLEANUP_PROMPT = """Clean up this dictated text. Rules:
- Remove filler words (um, uh, like, you know, so, basically)
- Fix grammar and punctuation
- Handle corrections ("no wait", "I mean", "actually") by keeping only final intent
- Do NOT change meaning or add information
- Return ONLY the cleaned text, nothing else.

Dictated text: {text}"""

class PostProcessor:
    def __init__(self, provider):
        self.provider = provider

    def clean(self, raw_text: str, context: str = None) -> str:
        prompt = CLEANUP_PROMPT.format(text=raw_text)
        if context:
            prompt += f"\nContext: This is being typed in {context}."
        return self.provider.complete(prompt)
```

### 1.4 Text Injection

```python
# src/openwhisper/injection/injector.py
import platform, pyperclip, time

class TextInjector:
    """Injects text at cursor position in any application."""

    def inject(self, text: str):
        # Save current clipboard
        old_clipboard = pyperclip.paste()
        # Set new text
        pyperclip.copy(text)
        # Simulate paste
        self._simulate_paste()
        # Restore clipboard after brief delay
        time.sleep(0.1)
        pyperclip.copy(old_clipboard)

    def _simulate_paste(self):
        system = platform.system()
        if system == "Darwin":
            self._paste_macos()
        elif system == "Windows":
            self._paste_windows()
        else:
            self._paste_linux()
```

### 1.5 Global Hotkey + Push-to-Talk

```python
# src/openwhisper/hotkey/listener.py
from pynput import keyboard

class HotkeyListener:
    """Listens for global hotkey to start/stop recording."""

    def __init__(self, on_start, on_stop, hotkey=keyboard.Key.ctrl_l):
        self.on_start = on_start
        self.on_stop = on_stop
        self.hotkey = hotkey
        self.is_pressed = False

    def start(self):
        listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
        )
        listener.start()

    def _on_press(self, key):
        if key == self.hotkey and not self.is_pressed:
            self.is_pressed = True
            self.on_start()

    def _on_release(self, key):
        if key == self.hotkey and self.is_pressed:
            self.is_pressed = False
            self.on_stop()
```

### 1.6 Main Orchestrator

```python
# src/openwhisper/main.py

class OpenWhisper:
    def __init__(self, config):
        self.recorder = AudioRecorder()
        self.stt = self._init_stt(config)
        self.processor = PostProcessor(self._init_ai_provider(config))
        self.injector = TextInjector()
        self.hotkey = HotkeyListener(
            on_start=self.recorder.start,
            on_stop=self._on_recording_done,
        )

    def _on_recording_done(self):
        audio = self.recorder.stop()
        raw_text = self.stt.transcribe(audio)
        clean_text = self.processor.clean(raw_text)
        self.injector.inject(clean_text)

    def run(self):
        self.hotkey.start()
        # Start system tray UI (blocks main thread)
        TrayUI(self).run()
```

---

## Phase 2 — Smart Features (Weeks 4–6)

### 2.1 Voice Activity Detection (VAD)
Use Silero VAD to auto-detect speech boundaries, enabling a "toggle mode" alongside push-to-talk where recording starts on voice and stops after silence.

### 2.2 Personal Dictionary
A JSON/TOML file of custom words (names, jargon, acronyms) injected into the Whisper prompt and the post-processing context so they're transcribed correctly.

### 2.3 Snippet Library
Voice-triggered shortcuts: say "insert email signature" and it expands to your full signature block. Stored as TOML:
```toml
[snippets]
"email signature" = "Best regards,\nAniruddha\nSol Foundry"
"zoom link" = "https://zoom.us/j/your-meeting-id"
```

### 2.4 Context-Aware Tone
Detect the active application (via window title) and adjust post-processing:
- **Slack/Discord** → casual, concise
- **Email** → professional, complete sentences
- **Code editor** → technical, preserve terms exactly
- **Document** → formal, proper paragraphs

### 2.5 Multi-Language + Code-Switching
Whisper already supports 99+ languages. Add auto-detect mode and allow mid-sentence language switching (e.g., English-Hindi) by passing `language=None` to let Whisper auto-detect.

---

## Phase 3 — Polish & Platforms (Weeks 7–10)

### 3.1 Desktop Packaging
| Platform | Tool | Output |
|----------|------|--------|
| macOS | PyInstaller + `create-dmg` | `.dmg` installer |
| Windows | PyInstaller + NSIS | `.exe` installer |
| Linux | PyInstaller + AppImage | `.AppImage` portable |

### 3.2 Settings UI
A proper settings window (PySide6 or `customtkinter`) for:
- STT engine selection (local Whisper model size vs. Groq)
- AI provider config (API keys, local Ollama endpoint)
- Hotkey customization
- Snippet management
- Personal dictionary editor
- Language preferences

### 3.3 Mobile (Stretch Goal)
Two realistic paths for mobile:

**Option A — Kivy/BeeWare:** Build a native mobile app in Python. Kivy compiles to iOS/Android but has UX limitations. BeeWare produces truly native UI but is less mature.

**Option B — Companion app approach:** Build a lightweight native app (Swift for iOS, Kotlin for Android) that shares the same Groq API backend. The mobile app handles audio capture + sends to Groq for transcription. This gives the best UX and is probably the practical choice.

### 3.4 Floating Overlay
A small floating indicator near the cursor showing:
- Recording state (pulsing mic icon)
- Transcription in progress (spinner)
- Brief flash of the cleaned text before injection

---

## Phase 4 — Community & Ecosystem (Ongoing)

### 4.1 Plugin System
An extensible plugin architecture so the community can add:
- Custom STT backends (Azure, AWS Transcribe, Deepgram)
- Custom AI providers
- Custom voice commands
- App-specific integrations

### 4.2 Sync (Optional)
If users want settings/dictionary/snippets to sync across devices, offer an optional self-hosted sync via a simple JSON API or use a service like Syncthing.

---

## Key Technical Decisions

### Why `faster-whisper` over standard Whisper?
`faster-whisper` uses CTranslate2, a C++ inference engine that runs Whisper 4× faster with lower memory. On an M1 Mac, a `base` model transcribes in near-realtime. On older hardware, the `tiny` model still works well.

### Why Groq for cloud STT?
Groq runs Whisper on custom LPU hardware with sub-second latency. Their free tier gives 14,400 requests/day — more than enough for personal use. This means users get Wispr-like speed without paying $15/month.

### Why clipboard-based text injection?
Direct keystroke simulation (`pyautogui`) is fragile across apps and OS versions. The clipboard approach (copy text → simulate Cmd/Ctrl+V) works universally in every app, including Electron apps, terminals, and web browsers. The tradeoff is briefly touching the clipboard, which we mitigate by saving/restoring it.

### Why Python over Rust/Tauri?
For an MVP targeting all platforms with AI/ML features, Python wins on iteration speed. The `faster-whisper` bindings, Groq/OpenAI SDKs, and audio libraries are all first-class in Python. If performance becomes an issue later, hot paths can be rewritten in Rust via PyO3.

---

## Getting Started (Developer Setup)

```bash
# Clone the repo
git clone https://github.com/your-org/openwhisper.git
cd openwhisper

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -e ".[dev]"

# Download Whisper model (first run)
python -m openwhisper.stt.whisper_local --download base

# Set up Groq API key (optional, for cloud mode)
export GROQ_API_KEY="your-key-here"

# Run
python -m openwhisper
```

### Dependencies (pyproject.toml)

```toml
[project]
name = "openwhisper"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "faster-whisper>=1.0",
    "sounddevice>=0.4",
    "numpy>=1.24",
    "soundfile>=0.12",
    "pynput>=1.7",
    "pyperclip>=1.8",
    "pystray>=0.19",
    "Pillow>=10.0",
    "httpx>=0.25",
    "tomli>=2.0",
    "tomli-w>=1.0",
]

[project.optional-dependencies]
ui = ["PySide6>=6.6"]
local-ai = ["ollama>=0.1"]
dev = ["pytest>=7.0", "ruff>=0.1", "pyinstaller>=6.0"]
```

---

## Existing Open-Source References

Study these projects for implementation patterns:

| Project | What to learn from it |
|---------|----------------------|
| [VoiceTypr](https://github.com/moinulmoin/voicetypr) | Tauri architecture, Whisper integration, global hotkey patterns |
| [OpenWhispr](https://openwhispr.com/) | Marketing, feature prioritization, multi-model support |
| [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) | Optimized C++ Whisper inference (can be used via Python bindings) |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | CTranslate2-based Whisper, the STT engine you'll use |
| [Silero VAD](https://github.com/snakers4/silero-vad) | Voice Activity Detection for auto-start/stop |

---

## Competitive Edge vs. Wispr Flow

| Feature | Wispr Flow | OpenWhisper |
|---------|-----------|-------------|
| Price | $15/mo | Free & open-source |
| Privacy | Cloud-processed audio | Fully offline option |
| Customization | Limited | Plugins, custom commands, open config |
| Self-hosting | No | Yes — your hardware, your data |
| AI provider | Locked to their models | Choose: Groq, Ollama, OpenAI, or any provider |
| Code | Proprietary | MIT licensed, community-driven |
