# remotion-lab · Video Üretim Fabrika Makefile'ı
# Kullanım: `make help` | `make produce` | `make render` | `make chapter ID=Chapter-01-giris`

PYTHON := .venv/bin/python
VOICE  ?= tr-TR-AhmetNeural
RATE   ?= +0%
SCRIPT ?=
OUT    ?= out/chapters.mp4
ID     ?= Chapter-01-giris

SCRIPT_ARG := $(if $(strip $(SCRIPT)),"$(SCRIPT)",)

.DEFAULT_GOAL := help

.PHONY: help produce factory voice plan promote render chapter build dev typecheck enhance transcribe sfx ambient clean

help: ## Kullanılabilir tüm üretim hedeflerini listeler
	@echo "remotion-lab · Makefile Hedefleri"
	@echo ""
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  make %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Parametreler: SCRIPT=yol.md  VOICE=$(VOICE)  RATE=$(RATE)  OUT=$(OUT)  ID=$(ID)"

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

render: typecheck ## Aktif src/data/chapters/*.json bölümlerini birleştirip ChaptersVideo MP4 render alır
	npx remotion render ChaptersVideo $(OUT)

chapter: typecheck ## Tek bir bölümü render alır (ör. make chapter ID=Chapter-01-giris OUT=out/test_01.mp4)
	npx remotion render $(ID) $(OUT)

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
