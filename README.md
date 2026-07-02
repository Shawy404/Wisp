<!-- Wisp — © Shawy404. All rights reserved. -->

# Wisp

> Gezinmek dağılmak değil, haritalamak olsun.

Wisp, araştırma için doğmuş bir masaüstü tarayıcıdır. Her araştırma konusu kendi
**odasında** yaşar: o odada gezdiğin sekmeler, aldığın notlar, topladığın
kaynaklar ve oluşan kavram haritası hep bir arada — ve hepsi senin diskinde.

İsmin kökeni: *will-o'-the-wisp* — bataklıkta yolcuları yönlendiren hayalet ışık.
Japon folklorundaki karşılığı *kitsunebi* (狐火), "tilki ateşi".

**Yaratıcı:** Shawy404 · © Shawy404, tüm hakları saklıdır.

## Özellikler

- **Odalar** — oda başına sekmeler, notlar, kaynaklar, harita. Oda değiştir →
  sekmeler takas olur; kapat-aç → geri gelir. Diskte oda başına klasör.
- **Temiz arama şeridi** — Semantic Scholar + Crossref + arXiv + Wikipedia
  (tr/en) + Openverse + DuckDuckGo paralel aranır; sorgu otomatik sınıflanır
  (akademik/genel). **Arama yakalama:** akademik + wiki + görsel sonuçlar
  otomatik olarak odanın kaynaklarına kaydedilir — elle atıf yazmazsın.
- **Adblocker** — EasyList + EasyPrivacy; ayarlardan toggle + site istisnası.
- **Reader modu** — Readability ile temiz okuma; tek tıkla odaya kaydet.
- **Klip** — sağ tık: tüm sayfa / seçili metin / görsel → `clips/` + kaynaklar.
- **Notlar** — CodeMirror 6 markdown, `notes/*.md` (Obsidian uyumlu),
  `[[wikilink]]` (Ctrl+tıkla aç/oluştur), `![[src-id]]` kaynak gömme.
- **Kavram haritası** — tek graph, üç görünüm. Bağlar: wikilink (yeşil ok),
  etiket-bazlı önerilen (kesikli, bedava, deterministik), manuel
  (Shift+tıkla iki düğüm), AI önerisi ("Bağlantıları bul" — istek üzerine tek
  Claude çağrısı, API anahtarı ayarlardan).
- **Araştırma araçları** — kaynak kartından BibTeX/APA/MLA kopyala; split view
  (kaynak|not); Ctrl+K komut paleti (`?sorgu` ile hızlı arama).
- **Cila** — koyu/açık tema + özel hex vurgu rengi; web dev modu (DevTools +
  arama JSON görüntüleyici); odak sayacı (pomodoro); profil etiketi.

## Kısayollar

| Kısayol | İşlev |
| --- | --- |
| Ctrl+T | Yeni sekme |
| Ctrl+W | Sekmeyi kapat |
| Ctrl+L | Adres çubuğu |
| Ctrl+K | Komut paleti |
| Shift+tıkla (haritada 2 düğüm) | Manuel bağ |
| Alt+tıkla (haritada bağ) | Manuel/AI bağı sil |
| Ctrl+tıkla (notta wikilink) | Hedef notu aç/oluştur |

## Kurulum ve çalıştırma

```bash
cd wisp
npm install          # bağımlılıklar + Electron ikili dosyası
npm run dev          # geliştirme modu (hot reload)
npm run build        # üretim paketi (out/)
npm run typecheck    # TS tip kontrolü
npm run build:linux  # AppImage üret (dist/)
```

> Electron ikili dosyası GitHub releases'ten indirilir. Kısıtlı ağlarda
> `ELECTRON_MIRROR` ortam değişkeniyle bir ayna tanımlayabilirsin.

## Mimari

- **Yığın:** Electron + React + TypeScript + Tailwind v4 (electron-vite),
  Cytoscape.js (harita), CodeMirror 6 (notlar), @mozilla/readability (reader),
  @ghostery/adblocker-electron (adblock), @anthropic-ai/sdk (AI önerileri).
- **Süreç ayrımı:** Main process pencere/sekmeler (WebContentsView), adblocker,
  arama toplama (net.fetch), dosya sistemi ve IPC'yi yönetir. Renderer yalnızca
  UI kabuğudur (`contextIsolation: true`, `nodeIntegration: false`, preload köprüsü).
- **Wayland/Hyprland:** frameless pencere + uygulama içi pencere kontrolleri,
  `ozone-platform-hint=auto`.
- **Local-first:** Hiçbir veri buluta gitmez (AI önerileri hariç — o da yalnızca
  istek üzerine, yalnızca düğüm başlıkları/etiketleri gider). Her şey `~/Wisp/`
  altındadır (`WISP_HOME` ile taşınabilir):

```
~/Wisp/
  config.json                 # global ayarlar (tema, adblock, API anahtarı, profil)
  rooms/
    <oda>/
      room.json               # oda meta + açık sekmeler + aktif sekme
      notes/*.md              # notlar (Obsidian uyumlu markdown)
      sources.json            # toplanan kaynaklar + metadata
      map.json                # kavram düğümleri + kalıcı bağlar
      clips/                  # klipslenen görseller / temizlenmiş sayfalar (.md)
```

- **Tek graph, üç görünüm:** Kenar çubuğundaki kaynak kartı, nottaki
  `[[wikilink]]` / `![[src-id]]` ve haritadaki düğüm aynı nesnedir.
  `shared/graph.ts` her oda verisinden grafiği türetir; birini düzenle →
  hepsi güncellenir.

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 0 | İskele + kimlik | ✅ |
| 1 | Tarayıcı çekirdeği + oda sistemi | ✅ |
| 2 | Temiz arama şeridi | ✅ |
| 3 | Adblocker + reader + klip | ✅ |
| 4 | Notlar | ✅ |
| 5 | Kavram haritası | ✅ |
| 6 | Araştırma araçları | ✅ |
| 7 | Cila + paketleme | ✅ (AppImage yapılandırması hazır — aşağıya bak) |

## Doğrulama notu (geliştirme oturumu)

Bu depo, dış ağı kısıtlı bir ortamda geliştirildi. Orada **doğrulanabilenler**:
TS tip kontrolü ve üretim build'i her fazda temiz; depolama katmanı, arama
parser'ları (sahte API yanıtlarıyla), wikilink/graph/atıf mantığı birim
testlerle; UI panelleri (arama, kaynaklar, notlar+CodeMirror, harita+Cytoscape,
palet, ayarlar/tema) gerçek Chromium'da sahte IPC köprüsüyle smoke testlerle.
**Doğrulanamayanlar** (Electron ikilisi ve canlı API'ler o ortamda inemedi):
pencere/sekme davranışının canlı hali, canlı arama uçları, EasyList indirme ve
AppImage üretimi — bunlar normal bir makinede `npm install && npm run dev` /
`npm run build:linux` ile çalışması beklenen, standart yollardır. İlk canlı
çalıştırmada bir pürüz çıkarsa muhtemel yer WebContentsView bounds/odak
davranışıdır.

## Bilinen sınırlamalar

- Gerçek Chrome extension API'si yok.
- Tam multi-process sandbox güvenliği hedeflenmedi (Electron varsayılanları +
  contextIsolation; sekme içerikleri sandboxed).
- Bulut senkronizasyonu ve mobil kapsam dışı.
- Web dev modu global bir toggle'dır (oda-bazlı ayar `room.json`'da rezerve).
- Çoklu profil şimdilik bir etiket; ayrı veri dizinleri için `WISP_HOME` kullan.
- DuckDuckGo web sonuçları HTML kazımadır; DDG işaretlemeyi değiştirirse
  "Web" sekmesi boş kalabilir (diğer kaynaklar etkilenmez).

## Sonraki adımlar

- Harita düğümüne çift tıkla → ilgili not/kaynağı aç (navigasyon köprüsü).
- Not önizleme (marked hazır, salt-okunur render).
- Oda-bazlı dev modu ve oda başına odak istatistikleri.
- `search:last` sonuçlarının diske yazılması (oturumlar arası arama geçmişi).
