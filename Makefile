# remotion-lab · Video Üretim Fabrika Makefile'ı (v3.0)
# Kullanım: `make help` | `make produce` | `make preview` | `make render` | `make chapter ID=Chapter-01-giris`

PYTHON        := .venv/bin/python
VOICE         ?= tr-TR-AhmetNeural
RATE          ?= +0%
SCRIPT        ?=
COMP          ?= ChaptersVideo
OUT           ?= out/chapters.mp4
PREVIEW_OUT   ?= out/test_preview.mp4
PREVIEW_SCALE ?= 0.5
PREVIEW_CRF   ?= 28
FINAL_CRF     ?= 18
FRAMES        ?=
ID            ?= Chapter-01-giris

SCRIPT_ARG := $(if $(strip $(SCRIPT)),"$(SCRIPT)",)
FRAMES_ARG := $(if $(strip $(FRAMES)),--frames=$(FRAMES),)

.DEFAULT_GOAL := help

.PHONY: help produce factory voice plan promote preview render chapter build dev typecheck enhance transcribe sfx ambient clean

help: ## Kullanılabilir tüm üretim hedeflerini listeler
	@echo "remotion-lab v3.0 · Makefile Hedefleri"
	@echo ""
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  make %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Parametreler: SCRIPT=yol.md  COMP=$(COMP)  OUT=$(OUT)  PREVIEW_OUT=$(PREVIEW_OUT)  FRAMES=0-180  ID=$(ID)"

produce: ## [Önerilen] inbox/ (veya SCRIPT) -> ses + WordBoundary + taslaklar + typecheck
	$(PYTHON) scripts/pipeline.py $(SCRIPT_ARG) --voice $(VOICE) --rate $(RATE)

factory: ## [Tam Otomatik] Ses + taslaklar + aktif chapters/ terfi + ChaptersVideo MP4 render
	$(PYTHON) scripts/pipeline.py $(SCRIPT_ARG) --voice $(VOICE) --rate $(RATE) --render --render-out $(OUT)

voice: ## Yalnızca ses (kayit.wav) ve WordBoundary transcript.json üretir
	$(PYTHON) scripts/generate_voice.py $(SCRIPT_ARG) --voice $(VOICE) --rate $(RATE)

plan: ## Mevcut transcript.json üzerinden 3-5 sn taslak üretir
	$(PYTHON) scripts/plan_timeline.py

promote: ## Onaylanan src/data/chapters_draft/*.json dosyalarını aktif src/data/chapters/ içine alır
	@mkdir -p src/data/chapters
	@rm -f src/data/chapters/*.json
	@cp src/data/chapters_draft/*.json src/data/chapters/
	@echo "[OK] Taslaklar src/data/chapters/ klasörüne taşındı."

preview: typecheck ## [Hızlı M1 Kontrolü] Yarı çözünürlük önizleme render'ı (--scale=0.5 --crf=28, opsiyonel FRAMES=0-180)
	npx remotion render $(COMP) $(PREVIEW_OUT) --scale=$(PREVIEW_SCALE) --crf=$(PREVIEW_CRF) $(FRAMES_ARG)

render: typecheck ## [Final Kalite] Tam çözünürlük MP4 render alır (--scale=1 --crf=18, opsiyonel FRAMES=...)
	npx remotion render $(COMP) $(OUT) --scale=1 --crf=$(FINAL_CRF) $(FRAMES_ARG)

chapter: typecheck ## Tek bir bölümü render alır (ör. make chapter ID=Chapter-01-giris OUT=out/test_01.mp4 FRAMES=0-150)
	npx remotion render $(ID) $(OUT) --scale=1 --crf=$(FINAL_CRF) $(FRAMES_ARG)

build: typecheck ## Tekil src/data/timeline.json (MainVideo) render alır
	npm run build

dev: ## Remotion Studio canlı önizleme sunucusunu başlatır
	npm run dev

typecheck: ## Zorunlu TypeScript (tsc --noEmit) kontrolünü çalıştırır
	npm run typecheck

enhance: ## Harici mikrofon/ElevenLabs sesini temizler ve duraksamaları keser
	$(PYTHON) scripts/enhance_audio.py

transcribe: ## Harici sesi faster-whisper ile transcript.json olarak çözer
	$(PYTHON) scripts/transcribe.py

sfx: ## Prosedürel whoosh, pop, tick, thud SFX dosyalarını üretir
	$(PYTHON) scripts/generate_sfx.py

ambient: ## 24 sn kesintisiz karanlık ambient arka plan müziği üretir
	$(PYTHON) scripts/generate_ambient.py

clean: ## Test render'larını (out/test_*.mp4) ve taslak kalıntılarını temizler
	rm -f out/test_*.mp4
	rm -f src/data/chapters_draft/*.json
	@echo "[OK] out/test_*.mp4 ve taslak JSON kalıntıları temizlendi."
