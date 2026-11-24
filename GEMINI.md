# GEMINI.md — `remotion-lab` Proje Anayasası

Bu dosya, `remotion-lab` deposunda çalışan tüm yapay zekâ ajanları için bağlayıcı mimari kuralları, görsel imza standartlarını ve üretim iş akışlarını tanımlar.

---

## 1. Mimari Özet & Klasör Haritası

**Amaç:** Veri güdümlü (JSON-driven), karanlık/minimalist mühendislik estetiğine sahip 3–5 dakikalık teknik proje sunumu ve devlog video motoru.

**Teknoloji Yığını:** Remotion `4.0.546` · React `19` · TypeScript `7` (`strict: true`) · Tailwind CSS `v4` (`remotion.config.ts`) · Python `.venv` (`edge-tts`, `faster-whisper`, `ffmpeg`, `numpy`, `pillow`).

```text
remotion-lab/
├── src/
│   ├── theme.ts                  # Tek doğruluk kaynağı (renk, font, 30 FPS, secToFrames, MOTION, GLASS_TOKENS, FILM_GRAIN_OPACITY)
│   ├── Root.tsx                  # MainVideo, ChaptersVideo, dinamik Chapter-* ve referans DemoScene kayıtları
│   ├── index.ts / index.css      # Remotion giriş noktası ve Tailwind v4 stilleri
│   ├── engine/
│   │   ├── TimelineRenderer.tsx  # Ana oynatıcı: PersistentBackgroundLayer, FilmGrainOverlay, EngineeringHUD, geçişler, ses/SFX/audioOffsetSec
│   │   ├── chapters.ts           # src/data/chapters/*.json alfabetik otomatik yükleyici ve birleştirici (require.context)
│   │   └── types.ts              # TimelineSpec, TimelineBeat (discriminated union), SfxKey, SceneTransition
│   ├── components/
│   │   ├── index.ts              # Kilitli Bileşen Kayıt Defteri (COMPONENTS — 10 modül)
│   │   ├── HighlighterText.tsx   # Kelime/öbek vurgulu tipografi (frameless + highlightAtSecs senkronu)
│   │   ├── GlassCard.tsx         # Cam yüzeyli odak kartı (otomatik arka plan blur)
│   │   ├── NodeFlow.tsx          # 2–3 düğümlü mimari akış diyagramı (DashedConnector + amber pulse)
│   │   ├── StepCard.tsx          # Kademeli adım listesi
│   │   ├── CodeWindow.tsx        # macOS kod penceresi (v3: focusSteps, diffLines, embedded)
│   │   ├── ComparisonCard.tsx    # 2 sütunlu hatalı vs. doğru yaklaşım karşılaştırması
│   │   ├── MediaWindow.tsx       # Görsel/GIF/MP4 (<OffthreadVideo />) çerçevesi (zoomPan + blur)
│   │   ├── MetricBanner.tsx      # Tam ekran bölüm geçişi / kritik sayı vuruşu (HUD gizli, thud SFX)
│   │   ├── SplitStage.tsx        # 60/40 (veya reverse 40/60) kod/medya/terminal + hero metrik sahnesi
│   │   ├── TerminalTrace.tsx     # Canlı curl + HTTP durum kodu + JSON yanıt akışı (sıfır sıçrama)
│   │   ├── CadFrame.tsx          # Yardımcı: CadCorners (┌ ┐ └ ┘) ve SpecularSweep
│   │   └── DashedConnector.tsx   # Yardımcı: FPS-bağımsız akan noktalı SVG Bezier bağlantısı
│   ├── backgrounds/
│   │   ├── index.ts              # Arka Plan Kayıt Defteri (BACKGROUNDS — 3 sürekli zemin)
│   │   ├── ObsidianGridBg.tsx    # obsidianGrid
│   │   ├── DotMatrixBg.tsx       # dotMatrix
│   │   └── RadialGlowBg.tsx      # radialGlow
│   ├── data/
│   │   ├── inbox/                # Buraya bırakılan en güncel .md/.txt betiği `produce` tarafından otomatik algılanır
│   │   ├── script.md             # inbox/ boşken kullanılan varsayılan Markdown anlatım betiği
│   │   ├── pronunciation.json    # edge-tts Türkçe teknik terim okunuş haritası (ekran yazımını kirletmez)
│   │   ├── timeline.json         # MainVideo aktif tekil zaman çizelgesi
│   │   ├── chapters/             # YALNIZCA aktif üretilen videonun bölüm JSON'ları (ChaptersVideo + Chapter-*)
│   │   ├── chapters_draft/       # --split-chapters / --split-by-script onay öncesi taslak bölümler
│   │   ├── examples/             # Vitrin, pilot ve bileşen test JSON'ları (ChaptersVideo'ya karışmaz)
│   │   ├── timeline_draft.json   # plan_timeline.py tarafından üretilen onay öncesi tekil taslak
│   │   ├── transcript.json       # edge-tts WordBoundary veya faster-whisper kelime zaman damgalı transkript
│   │   └── glossary.json         # Türkçe Whisper ASR & teknik terim düzeltme sözlüğü
│   └── scenes/
│       └── DemoScene.tsx         # Yalnızca tarihsel referans (60 FPS); yeni çalışmalarda baz alınmaz
├── scripts/
│   ├── generate_voice.py         # script.md -> edge-tts (WordBoundary) + pronunciation.json -> kayit.wav & transcript.json
│   ├── pipeline.py               # Tek komutluk taslak üretim boru hattı (`npm run produce`: voice -> plan -> typecheck)
│   ├── enhance_audio.py          # 2-pass -14 LUFS mastering + akıllı duraksama kesici -> kayit_temiz.wav
│   ├── transcribe.py             # faster-whisper + PyAV 19+ ffmpeg fallback -> transcript.json
│   ├── plan_timeline.py          # glossary.json + 3–5 sn beat planlayıcı + highlightAtSecs + --split-chapters / --split-by-script
│   ├── generate_ambient.py       # 24 sn kesintisiz karanlık ambient pad -> public/audio/ambient.mp3
│   └── generate_sfx.py           # public/sfx/{whoosh,pop,tick,thud}.wav üretici
├── public/
│   ├── audio/                    # Ham kayıtlar (dokunulmaz), kayit_temiz.wav, ambient.mp3
│   ├── media/                    # Ekran görüntüleri, diyagramlar, kısa MP4 klipleri
│   └── sfx/                      # whoosh.wav, pop.wav, tick.wav, thud.wav
└── out/                          # Render edilen .mp4 çıktıları (.gitignore kapsamında, Git'e eklenmez)
```

---

## 2. Değişmez Kurallar & Yasaklar

1. **Varsayılan Kilitli Motor Sınırı:**
   Yeni video, bölüm veya zaman çizelgesi üretim görevlerinde yalnızca `src/data/` ve `public/` değiştirilir. Kullanıcı açıkça *"motor/bileşen yükseltmesi"* istemedikçe `src/theme.ts`, `src/engine/`, `src/backgrounds/`, `src/components/` ve `src/Root.tsx` dosyalarına **kesinlikle dokunulmaz**.
2. **Kayıt Defteri (Registry) Disiplini:**
   Onaylı bir yükseltme ile yeni bileşen veya arka plan eklenecekse mutlaka `src/components/index.ts` + `src/engine/types.ts` (veya `src/backgrounds/index.ts`) kayıt defterlerine tam TypeScript tipleriyle eklenir. `src/Root.tsx` içine video-özel sabit sahne yazılmaz.
3. **Aktif `src/data/chapters/` Klasör Hijyeni:**
   `src/engine/chapters.ts` klasördeki tüm `*.json` dosyalarını otomatik olarak `ChaptersVideo` içine birleştirir. Bu nedenle `src/data/chapters/` **yalnızca o an üretilen aktif videonun bölümlerini** barındırır; vitrin, pilot ve test JSON'ları `src/data/examples/` altında tutulur.
4. **Taslak Öncelikli & Tahribatsız Güncelleme Kuralı:**
   - Otomatik planlayıcı çıktıları her zaman önce `src/data/timeline_draft.json` veya `src/data/chapters_draft/` konumuna yazılır.
   - Kullanıcının açık onayı olmadan üretim dosyalarının (`src/data/timeline.json` veya `src/data/chapters/*.json`) üzerine doğrudan yazılmaz / taşınmaz.
   - `public/audio/` içindeki ham ses kayıtları asla üzerine yazılarak tahrip edilmez; temizlenmiş çıktı ayrı dosya (`kayit_temiz.wav` vb.) olarak üretilir.
5. **Otomatik `glossary.json` Öğrenme Kuralı:**
   Transkript analizi veya sahne planlaması sırasında yeni bir teknik terim yazım hatası veya Whisper Türkçe telaffuz hatası tespit edildiğinde, bu eşleşme **standart olarak `src/data/glossary.json` içine otomatik eklenir** (böylece sonraki tüm videolarda da otomatik düzelir).
6. **3–5 Saniye Tempo Kuralı:**
   Hiçbir `beat` 5.0 saniyeyi geçemez; ekranda 5 saniyeden uzun sabit görüntü bırakılmaz. Hedef sahne süresi `3.0–5.0 sn`dir.
7. **FPS-Bağımsız Zamanlama & Yay Fiziği Zorunluluğu:**
   - Bileşen içi tüm gecikmeler ham kare sayısı yerine `secToFrames(saniye, fps)` ile tanımlanır.
   - Doğrusal (`linear`) veya robotik giriş animasyonları yasaktır; yalnızca `MOTION.snap`, `MOTION.editorial` ve `MOTION.impact` yay profilleri kullanılır.
8. **Sıfır Düzen Sıçraması (Zero Layout Shift):**
   Kademeli açılan veya yazma animasyonu içeren bileşenlerde (`TerminalTrace`, `CodeWindow` vb.) sonradan görünecek blokların boyutu ilk kareden itibaren DOM'da rezerve edilir (`visibility: hidden` + `opacity: 0`).
9. **Sürekli Arka Plan & Medya Kuralı:**
   Arka planlar yalnızca `TimelineRenderer` içindeki global `PersistentBackgroundLayer` tarafından yönetilir (beat `<Sequence>` içine arka plan bileşeni konulmaz). Video kliplerinde her zaman `<OffthreadVideo />` kullanılır.
10. **Temizlik, Adlandırma & Ortam Kuralları:**
    - `src/scenes/DemoScene.tsx` (`60 FPS`) yalnızca tarihsel referanstır; yeni sahne/kompozisyonlarda şablon olarak kullanılmaz.
    - `out/` dizini `.gitignore` altındadır ve Git'e eklenmez. Deneme/doğrulama render'ları her zaman **`out/test_*.mp4`** adıyla üretilir; nihai teslimatlar anlamlı adlar (`out/video.mp4`, `out/chapters.mp4`, `out/<proje>_bolum_01.mp4`) taşır.
    - Tüm Python betikleri sistem Python'ı ile değil **`.venv/bin/python`** ile çalıştırılır.

---

## 3. Görsel İmza & 30 FPS Standartları

- **Çözünürlük & Kare Hızı:** `1920×1080`, **`30 FPS`** (M1 MacBook Air düşük RAM tüketimi ve 2x hızlı render standardı). 5 dakikalık videolar `~60 sn`lik bağımsız bölümler (`chapters/*.json`) hâlinde kurgulanır.
- **Renk Sistemi (`src/theme.ts`):**
  - `%92` Monokrom Vantablack/Obsidian zemin (`#07090d` / `#040609`) + Gümüş-Beyaz tipografi (`#e6edf3` / `#94a3b8`)
  - Tek imza vurgu: **Sıcak Mühendislik Kehribarı (`#f59e0b` / `#fbbf24`)**
  - Semantik durum renkleri (yalnızca karşılaştırma, diff ve HTTP durumları): Hata/Eski `#f87171`, Başarı/Yeni `#34d399`
- **Tipografi & Türkçe Karakter Garantisi:**
  - Başlık/anlatım: `IBM Plex Sans` (`latin`, `latin-ext`)
  - Kod/etiket/sayısal veriler: `JetBrains Mono` (`latin`, `latin-ext`, `tabular-nums`)
- **Geometri, Doku & HUD:**
  - Keskin `12px` / `8px` köşe yarıçapı (`GLASS_TOKENS`), `1px solid rgba(255,255,255,0.08)` kenarlık
  - CAD köşe nişangâhları (`CadCorners`: `┌ ┐ └ ┘`), `SpecularSweep`, kartsız (`frameless`) tipografi modu
  - Global `%2.5` monokrom film greni (`FILM_GRAIN_OPACITY = 0.025`, H.264 banding önleyici)
  - Minimalist `EngineeringHUD`: sol üst bölüm/sahne izi + altta `2px` kehribar ilerleme çizgisi (`MetricBanner` üzerinde otomatik gizlenir)
- **Ses Miksajı & SFX Standardı:**
  - Ana konuşma sesi: `volume: 1.0` (`-14 LUFS`, `-1.5 dBTP`); bölünmüş tekil bölümlerde `audioOffsetSec` ile tam senkron
  - Arka plan ambiyans (`audio/ambient.mp3`): `bgMusicVolume: 0.06` (loop + otomatik giriş/çıkış fade)
  - Varsayılan SFX ataması: `MetricBanner` → `thud`, `CodeWindow` / `StepCard` / `TerminalTrace` → `tick`, açılış sahnesi → `whoosh`, diğer kartlar → `pop` (`0.13–0.22`)

---

## 4. Standart İş Akışları

### A. Metinden Tek Komutla Üretim Akışı (`inbox/` veya `script.md` + `edge-tts` — Önerilen)
1. **Anlatım Betiği:** Anlatım metni `## Bölüm 1: ...` başlıklarıyla `src/data/inbox/` klasörüne herhangi bir `.md`/`.txt` dosyası olarak bırakılır (boşsa `src/data/script.md` kullanılır); gerekiyorsa telaffuzlar `src/data/pronunciation.json` dosyasına eklenir.
2. **Tek Komutluk Boru Hattı (Taslak Öncelikli veya `--render` Fabrika):**
   ```bash
   make produce   # (veya: npm run produce) -> inbox/ en yeni dosya -> taslaklar + typecheck
   make promote   # Onay sonrası taslakları aktif src/data/chapters/ içine alır
   make factory   # (veya: npm run produce -- --render) -> Tam otomatik MP4 render
   ```
   Varsayılan `produce` komutu `src/data/timeline_draft.json` ve `src/data/chapters_draft/*.json` üretip durur; aktif `src/data/chapters/` dosyalarını ezmez ve `--render` verilmedikçe uzun render başlatmaz.
3. **Önizleme & Tekil Bölüm Render:** `make dev` ile Studio'da önizlenir; tek bölüm için `make chapter ID=<ChapterId> OUT=out/test_01.mp4` çalıştırılır.

### B. Harici Ses Kaydından Üretim Akışı (Mikrofon / ElevenLabs)
1. **Ham Ses Ekleme:** Ham kayıt `public/audio/` altına eklenir (orijinal dosya değiştirilmez).
2. **Ses İyileştirme & Duraksama Kesimi:**
   ```bash
   npm run enhance
   ```
3. **Kelime Zaman Damgalı Transkripsiyon:**
   ```bash
   npm run transcribe
   ```
4. **Sözlük Güncelleme & Taslak Üretimi:**
   - Transkriptte yeni teknik terim veya Whisper hatası görülürse önce `src/data/glossary.json` güncellenir.
   - Tekil taslak için:
     ```bash
     npm run plan
     ```
   - 5 dakikalık videoyu `~60 sn`lik taslak bölümlere ayırmak için (`audioOffsetSec` otomatik eklenir):
     ```bash
     .venv/bin/python scripts/plan_timeline.py --split-chapters 60 --chapters-dir src/data/chapters_draft
     ```
5. **Kullanıcı Onayı & Üretime Taşıma:**
   Üretilen `timeline_draft.json` / `chapters_draft/` özeti kullanıcıya sunulur; **onay alındıktan sonra** aktif `src/data/timeline.json` veya `src/data/chapters/*.json` konumuna taşınır.
6. **Canlı Önizleme (Remotion Studio):**
   ```bash
   npm run dev
   ```
   Studio önizlemesinde hiçbir sahnede `[UYARI: >5sn sabit sahne]` rozeti görünmemelidir.
7. **Render:**
   - Tekil bölüm (önerilen): `npm run build:chapter -- <ChapterId> out/<dosya>.mp4`
   - Tekil ana video: `npm run build`
   - Tüm aktif bölümlerin birleşimi (yalnızca kullanıcı onayıyla): `npm run build:chapters`

### C. Motor / Bileşen Yükseltme Akışı (Yalnızca Açık Kullanıcı İzniyle)
1. Tüm renk/font/hareket sabitlerini `src/theme.ts` üzerinden al, `secToFrames` ve `MOTION.*` kullan.
2. Kademeli elemanlarda sıfır düzen sıçraması (`visibility: hidden`) uygula.
3. Bileşeni `src/components/index.ts` ve `src/engine/types.ts` kayıt defterlerine ekle.
4. Örnek JSON'u `src/data/examples/` altında oluşturup Bölüm 5'teki doğrulama kapılarından geçir.

---

## 5. Doğrulama Komutları & M1 Render Politikası

**M1 MacBook Air Kaynak Koruması:** Ajan, kullanıcının açık onayı olmadan uzun (`>60 sn` veya tam 5 dakikalık `ChaptersVideo`) render işlemi **başlatmaz**.

Her değişiklik veya üretim teslimatında standart doğrulama sırası şudur:

1. **Tip & Şema Doğrulaması (Zorunlu):**
   ```bash
   npm run typecheck
   ```
   (`tsc --noEmit` — 0 hata zorunludur.)

2. **Tempo & Planlayıcı Kontrolü (Zaman Çizelgesi İşlerinde):**
   ```bash
   npm run plan
   ```
   Çıktıda `>5sn ihlali: 0` olduğu ve `highlightAtSecs` senkronlarının doğru üretildiği doğrulanır.

3. **Tekil Bölüm Test Render'ı veya Kritik Kare Görsel QA:**
   - Kısa/tekil bölüm testi (`out/test_*.mp4` adlandırmasıyla):
     ```bash
     npm run build:chapter -- <ChapterId> out/test_<konu>.mp4
     ```
   - Kritik geçiş, kod vurgusu, terminal yanıtı ve Türkçe karakter kontrolü için `ffmpeg` still çıkarımı ve görsel inceleme:
     ```bash
     ffmpeg -y -ss <saniye> -i out/test_<konu>.mp4 -frames:v 1 /tmp/qa_frame.png -loglevel error
     ```
   - Her kontrol karesinde taşma, üst üste binme, düzen sıçraması ve Türkçe karakter (`ç, ğ, ı, İ, ö, ş, ü`) keskinliği doğrulanır.
