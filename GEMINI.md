# GEMINI.md — `remotion-lab` Proje Anayasası (v3.0)

Bu dosya, `remotion-lab` deposunda çalışan tüm yapay zekâ ajanları için bağlayıcı mimari kuralları, çoklu tema standartlarını ve üretim iş akışlarını tanımlar.

---

## 0. Zorunlu Ajan Protokolü (Ön-Mülakat & Cerrahi Müdahale)

### Kural 1 — Tahmin Yasaktır (Ön-Mülakat Kapısı / Pre-Flight Interview)
Kullanıcı yeni bir video oluşturmanı istediğinde **ASLA doğrudan senaryo (`script.md`) veya zaman çizelgesi JSON'u üretme**. Önce hiçbir dosya değiştirmeden **tek mesajda şu 5 soruyu sor ve kullanıcının yanıtını bekle**:

1. **Hedef süre ve video formatı:** Video kaç dakika olacak ve tekil (`timeline.json`) mi yoksa bölümlü (`chapters/*.json`) mü kurgulanacak?
2. **Tema profili ve sahne ritmi:** Hangi görsel kimlik profili (`obsidianAmber`, `crtPhosphor`, `blueprintCyan`, `editorialPaper`) ve nasıl bir sahne ritmi (`director.json` varsayılanı `3.5–6.0 sn` vs. daha hızlı/yavaş tempo) tercih ediliyor?
3. **Görsel varlık stratejisi:** Kullanıcının elinde hazır MP4/WebM B-Roll, ekran kaydı veya görsel var mı; yoksa kare bazlı prosedürel SVG simülasyonları (`MemoryBarSim`, `RayCastConeSim`) ve/veya Python Pillow teknik diyagramları mı tercih edilecek?
4. **Anlatım tonu ve teknik derinlik seviyesi:** Hedef kitle (giriş, orta, derin sistem mühendisliği) ve anlatım üslubu nasıl olmalı?
5. **Kapanışta kaynakça:** Video sonunda kaynakça / GitHub repo listesi (`ReferenceList`) yer alacak mı?

### Kural 2 — Cerrahi Müdahale (Surgical Intervention)
Kullanıcı zamanlama, konuşma boşluğu, geçiş hızı, yay sertliği veya animasyon gecikmesi düzeltmesi istediğinde **`.tsx` bileşenlerini baştan yazma**:
1. Önce merkezi yönetmen dosyasındaki (`src/config/director.json`) ilgili parametreleri (`timing.*`, `transitions.*`, `activeTheme`) güncelle.
2. Ardından tüm videoyu baştan render etmek yerine yalnızca ilgili kare aralığını (`--frames=<başlangıç>-<bitiş>` veya `make preview COMP=<Id> FRAMES=<başlangıç>-<bitiş>`) render ederek doğrula.

---

## 1. Mimari Özet & Klasör Haritası

**Amaç:** Veri güdümlü (JSON-driven), çoklu tema profillerine (`obsidianAmber`, `crtPhosphor`, `blueprintCyan`, `editorialPaper`), kare bazlı prosedürel SVG simülasyonlarına ve merkezi yönetmen konfigürasyonuna (`src/config/director.json`) sahip 3–5 dakikalık teknik proje sunumu ve sistem arkeolojisi video motoru.

**Teknoloji Yığını:** Remotion `4.0.546` · React `19` · TypeScript `7` (`strict: true`) · Tailwind CSS `v4` (`remotion.config.ts`: `concurrency=2`, `angle`) · Python `.venv` (`edge-tts`, `faster-whisper`, `ffmpeg`, `numpy`, `pillow`).

```text
remotion-lab/
├── src/
│   ├── config/
│   │   ├── director.json         # Merkezi yönetmen ayarları (activeTheme, timing, transitions, previewRender)
│   │   └── director.ts           # Tip güvenli DIRECTOR_CONFIG dışa aktarımı
│   ├── themes/
│   │   ├── index.ts              # THEMES kayıt defteri, resolveTheme(), themeToCssVars()
│   │   ├── obsidianAmber.json    # Koyu Obsidian + Sıcak Mühendislik Kehribarı (varsayılan)
│   │   ├── crtPhosphor.json      # 1990'lar retro CRT fosfor yeşili + hafif scanline dokusu
│   │   ├── blueprintCyan.json    # Koyu lacivert + camgöbeği teknik mimari çizim teması
│   │   └── editorialPaper.json   # Yüksek kontrastlı açık kağıt belgesel / akademik analiz teması
│   ├── theme.ts                  # Tek doğruluk kaynağı (CSS var --rl-* COLORS, ThemeProvider, useActiveTheme, FONTS, 30 FPS, secToFrames, MOTION)
│   ├── Root.tsx                  # MainVideo, ChaptersVideo, dinamik Chapter-* ve referans DemoScene kayıtları
│   ├── index.ts / index.css      # Remotion giriş noktası ve Tailwind v4 stilleri
│   ├── engine/
│   │   ├── TimelineRenderer.tsx  # Ana oynatıcı: ThemeProvider, director.json geçişleri, PersistentBackgroundLayer, ScanlineOverlay, FilmGrainOverlay, EngineeringHUD
│   │   ├── chapters.ts           # src/data/chapters/*.json alfabetik otomatik yükleyici ve birleştirici (require.context)
│   │   └── types.ts              # TimelineSpec (opsiyonel theme), TimelineBeat (discriminated union — 13 bileşen), SfxKey, SceneTransition
│   ├── components/
│   │   ├── index.ts              # Kilitli Bileşen Kayıt Defteri (COMPONENTS — 13 modül)
│   │   ├── HighlighterText.tsx   # Kelime/öbek vurgulu tipografi (frameless + highlightAtSecs senkronu)
│   │   ├── GlassCard.tsx         # Cam yüzeyli odak kartı (otomatik arka plan blur)
│   │   ├── NodeFlow.tsx          # 2–3 düğümlü mimari akış diyagramı (DashedConnector + tema vurgu pulse)
│   │   ├── StepCard.tsx          # Kademeli adım listesi
│   │   ├── CodeWindow.tsx        # macOS kod penceresi (v3: focusSteps, diffLines, embedded)
│   │   ├── ComparisonCard.tsx    # 2 sütunlu hatalı vs. doğru yaklaşım karşılaştırması
│   │   ├── MediaWindow.tsx       # Görsel/GIF/MP4/WebM B-Roll (<Loop><OffthreadVideo muted /></Loop>) çerçevesi (zoomPan + blur)
│   │   ├── MetricBanner.tsx      # Tam ekran bölüm geçişi / kritik sayı vuruşu (HUD gizli, thud SFX)
│   │   ├── SplitStage.tsx        # 60/40 (veya reverse 40/60) kod/medya/terminal + hero metrik sahnesi
│   │   ├── TerminalTrace.tsx     # Canlı curl + HTTP durum kodu + JSON yanıt akışı (sıfır sıçrama)
│   │   ├── MemoryBarSim.tsx      # Prosedürel SVG: Arena/Hunk/Heap doluş, parçalanma ve O(1) offset=0 sıfırlama simülasyonu
│   │   ├── RayCastConeSim.tsx    # Prosedürel SVG: Dönen FOV görüş konisi, gerçek zamanlı 2D ışınlar ve BSP/PVS düğüm vurgusu
│   │   ├── ReferenceList.tsx     # Kapanış kaynakça, makale ve GitHub repo listesi kartı
│   │   ├── CadFrame.tsx          # Yardımcı: CadCorners (┌ ┐ └ ┘) ve SpecularSweep
│   │   └── DashedConnector.tsx   # Yardımcı: FPS-bağımsız akan noktalı SVG Bezier bağlantısı
│   ├── backgrounds/
│   │   ├── index.ts              # Arka Plan Kayıt Defteri (BACKGROUNDS — 3 tema-duyarlı sürekli zemin)
│   │   ├── ObsidianGridBg.tsx    # obsidianGrid
│   │   ├── DotMatrixBg.tsx       # dotMatrix
│   │   └── RadialGlowBg.tsx      # radialGlow
│   ├── data/
│   │   ├── archive/              # Korunan geçmiş proje yedekleri (asla silinmez)
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
│   ├── plan_timeline.py          # director.json + glossary.json beat planlayıcı + highlightAtSecs + --split-chapters / --split-by-script
│   ├── generate_ambient.py       # 24 sn kesintisiz karanlık ambient pad -> public/audio/ambient.mp3
│   └── generate_sfx.py           # public/sfx/{whoosh,pop,tick,thud}.wav üretici
├── public/
│   ├── audio/                    # Ham kayıtlar (dokunulmaz), kayit_temiz.wav, ambient.mp3
│   ├── media/                    # Ekran görüntüleri, Python Pillow diyagramları, MP4/WebM B-Roll klipleri
│   └── sfx/                      # whoosh.wav, pop.wav, tick.wav, thud.wav
└── out/                          # Render edilen .mp4 çıktıları (.gitignore kapsamında, Git'e eklenmez)
```

---

## 2. Değişmez Kurallar & Yasaklar

1. **Varsayılan Kilitli Motor Sınırı:**
   Yeni video, bölüm veya zaman çizelgesi üretim görevlerinde yalnızca `src/data/`, `public/` ve (zamanlama/tema ayarı gerekiyorsa) `src/config/director.json` değiştirilir. Kullanıcı açıkça *"motor/bileşen yükseltmesi"* istemedikçe `src/theme.ts`, `src/themes/`, `src/engine/`, `src/backgrounds/`, `src/components/` ve `src/Root.tsx` dosyalarına **kesinlikle dokunulmaz**.
2. **Kayıt Defteri (Registry) Disiplini:**
   Onaylı bir yükseltme ile yeni bileşen, tema veya arka plan eklenecekse mutlaka `src/components/index.ts` + `src/engine/types.ts` (veya `src/themes/index.ts` / `src/backgrounds/index.ts`) kayıt defterlerine tam TypeScript tipleriyle eklenir. `src/Root.tsx` içine video-özel sabit sahne yazılmaz.
3. **Aktif `src/data/chapters/` Klasör Hijyeni:**
   `src/engine/chapters.ts` klasördeki tüm `*.json` dosyalarını otomatik olarak `ChaptersVideo` içine birleştirir. Bu nedenle `src/data/chapters/` **yalnızca o an üretilen aktif videonun bölümlerini** barındırır; geçmiş projeler `src/data/archive/`, vitrin ve test JSON'ları `src/data/examples/` altında tutulur.
4. **Taslak Öncelikli & Tahribatsız Güncelleme Kuralı:**
   - Otomatik planlayıcı çıktıları her zaman önce `src/data/timeline_draft.json` veya `src/data/chapters_draft/` konumuna yazılır.
   - Kullanıcının açık onayı olmadan üretim dosyalarının (`src/data/timeline.json` veya `src/data/chapters/*.json`) üzerine doğrudan yazılmaz / taşınmaz; mevcut projeler asla silinmez.
   - `public/audio/` içindeki ham ses kayıtları asla üzerine yazılarak tahrip edilmez; temizlenmiş çıktı ayrı dosya (`kayit_temiz.wav` vb.) olarak üretilir.
5. **Otomatik `glossary.json` Öğrenme Kuralı:**
   Transkript analizi veya sahne planlaması sırasında yeni bir teknik terim yazım hatası veya Whisper Türkçe telaffuz hatası tespit edildiğinde, bu eşleşme **standart olarak `src/data/glossary.json` içine otomatik eklenir** (böylece sonraki tüm videolarda da otomatik düzelir).
6. **Merkezi Sahne Ritim Kuralı (`director.json`):**
   Sahne süreleri `src/config/director.json` içindeki `timing.minSceneDurationSec` (`3.5 sn`) ve `timing.maxSceneDurationSec` (`6.0 sn`) sınırlarına uyar; ekranda `maxSceneDurationSec` değerini aşan sabit sahne bırakılmaz.
7. **FPS-Bağımsız Zamanlama & Yay Fiziği Zorunluluğu:**
   - Bileşen içi tüm gecikmeler ham kare sayısı yerine `secToFrames(saniye, fps)` ile tanımlanır.
   - Doğrusal (`linear`) veya robotik giriş animasyonları yasaktır; yalnızca `MOTION.snap`, `MOTION.editorial`, `MOTION.impact` veya `director.json` yay parametreleri kullanılır.
8. **Sıfır Düzen Sıçraması (Zero Layout Shift):**
   Kademeli açılan veya yazma animasyonu içeren bileşenlerde (`TerminalTrace`, `CodeWindow` vb.) sonradan görünecek blokların boyutu ilk kareden itibaren DOM'da rezerve edilir (`visibility: hidden` + `opacity: 0`).
9. **Sürekli Arka Plan & Medya Kuralı:**
   Arka planlar yalnızca `TimelineRenderer` içindeki global `PersistentBackgroundLayer` tarafından yönetilir (beat `<Sequence>` içine arka plan bileşeni konulmaz). B-Roll video kliplerinde her zaman `MediaWindow` üzerinden `<Loop><OffthreadVideo muted /></Loop>` kullanılır.
10. **Temizlik, Adlandırma & Ortam Kuralları:**
    - `src/scenes/DemoScene.tsx` (`60 FPS`) yalnızca tarihsel referanstır; yeni sahne/kompozisyonlarda şablon olarak kullanılmaz.
    - `out/` dizini `.gitignore` altındadır ve Git'e eklenmez. Deneme/doğrulama render'ları her zaman **`out/test_*.mp4`** adıyla üretilir; nihai teslimatlar anlamlı adlar (`out/video.mp4`, `out/chapters.mp4`, `out/<proje>.mp4`) taşır.
    - Tüm Python betikleri sistem Python'ı ile değil **`.venv/bin/python`** ile çalıştırılır.

---

## 3. Çoklu Tema Profilleri & 30 FPS Standartları

- **Çözünürlük & Kare Hızı:** `1920×1080`, **`30 FPS`** (fansız M1 MacBook Air için `remotion.config.ts` üzerinde `Config.setConcurrency(2)` ve `Config.setChromiumOpenGlRenderer("angle")` aktiftir). 5 dakikalık videolar `~60 sn`lik bağımsız bölümler (`chapters/*.json`) hâlinde kurgulanır.
- **4 Tema Profili (`src/themes/` + `TimelineSpec.theme` -> varsayılan `director.json`):**
  - `obsidianAmber` (varsayılan): Koyu Obsidian (`#07090d`) + Sıcak Mühendislik Kehribarı (`#f59e0b`) — sistem/donanım sunumları
  - `crtPhosphor`: 1990'lar retro CRT fosfor yeşili (`#39ff88`) + hafif `ScanlineOverlay` dokusu — sistem arkeolojisi
  - `blueprintCyan`: Koyu lacivert (`#061124`) + camgöbeği (`#22d3ee`) teknik çizim estetiği — mimari ve bellek diyagramları
  - `editorialPaper`: Yüksek kontrastlı açık kağıt (`#f6f2e8`) + mürekkep/terakota (`#b45309`) — algoritma ve akademik analizler
- **Tipografi & Türkçe Karakter Garantisi:**
  - Başlık/anlatım: `IBM Plex Sans` (`latin`, `latin-ext`)
  - Kod/etiket/sayısal veriler: `JetBrains Mono` (`latin`, `latin-ext`, `tabular-nums`)
- **Geometri, Doku & HUD:**
  - Keskin `12px` / `8px` köşe yarıçapı (`GLASS_TOKENS`), CAD köşe nişangâhları (`CadCorners`), `SpecularSweep`, kartsız (`frameless`) tipografi modu
  - Tema-duyarlı monokrom film greni (`FilmGrainOverlay`, H.264 banding önleyici) ve CRT scanline katmanı (`ScanlineOverlay`)
  - Minimalist `EngineeringHUD`: sol üst bölüm/sahne izi + altta `2px` aktif tema ilerleme çizgisi (`MetricBanner` üzerinde otomatik gizlenir)
- **Ses Miksajı & SFX Standardı:**
  - Ana konuşma sesi: `volume: 1.0` (`-14 LUFS`, `-1.5 dBTP`); bölünmüş tekil bölümlerde `audioOffsetSec` ile tam senkron
  - Arka plan ambiyans (`audio/ambient.mp3`): `bgMusicVolume: 0.06` (loop + otomatik giriş/çıkış fade)
  - Varsayılan SFX ataması: `MetricBanner` → `thud`, `CodeWindow` / `StepCard` / `TerminalTrace` / `MemoryBarSim` / `RayCastConeSim` → `tick`, açılış sahnesi → `whoosh`, diğer kartlar (`ReferenceList` dahil) → `pop` (`0.13–0.22`)

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

**M1 MacBook Air Kaynak Koruması:** `remotion.config.ts` içinde `Config.setConcurrency(2)` ve `Config.setChromiumOpenGlRenderer("angle")` sabitlenmiştir. Ajan, kullanıcının açık onayı olmadan uzun (`>60 sn` veya tam 5 dakikalık `ChaptersVideo`) final render işlemi **başlatmaz**; ince ayarlar için `make preview` ve `--frames=...` kullanır.

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
   Çıktıda `director.json` ritmine aykırı ihlal (`>maxSceneDurationSec`) bulunmadığı ve `highlightAtSecs` senkronlarının doğru üretildiği doğrulanır.

3. **Hızlı Önizleme (`make preview`), Cerrahi Kare Aralığı veya Final Render (`make render`):**
   - Hızlı M1 önizleme (`--scale=0.5 --crf=28`, opsiyonel `FRAMES`):
     ```bash
     make preview COMP=<ChapterId> FRAMES=0-180 PREVIEW_OUT=out/test_preview.mp4
     ```
   - Final kalite çıktı (`--scale=1 --crf=18`, yalnızca onay sonrası):
     ```bash
     make render OUT=out/<proje>.mp4
     ```
   - Kritik geçiş, prosedürel SVG animasyonu, kod vurgusu ve Türkçe karakter kontrolü için `ffmpeg` still çıkarımı:
     ```bash
     ffmpeg -y -ss <saniye> -i out/test_preview.mp4 -frames:v 1 /tmp/qa_frame.png -loglevel error
     ```
   - Her kontrol karesinde taşma, üst üste binme, düzen sıçraması ve Türkçe karakter (`ç, ğ, ı, İ, ö, ş, ü`) keskinliği doğrulanır.
