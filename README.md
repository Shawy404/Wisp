<!-- Wisp — © Shawy404. All rights reserved. -->

# Wisp

> Gezinmek dağılmak değil, haritalamak olsun.

Wisp, araştırma için doğmuş bir masaüstü tarayıcıdır. Her araştırma konusu kendi
**odasında** yaşar: o odada gezdiğin sekmeler, aldığın notlar, topladığın
kaynaklar ve oluşan kavram haritası hep bir arada — ve hepsi senin diskinde.

İsmin kökeni: *will-o'-the-wisp* — bataklıkta yolcuları yönlendiren hayalet ışık.
Japon folklorundaki karşılığı *kitsunebi* (狐火), "tilki ateşi".

**Yaratıcı:** Shawy404 · © Shawy404, tüm hakları saklıdır.

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

- **Yığın:** Electron + React + TypeScript + Tailwind (electron-vite ile).
- **Süreç ayrımı:** Main process pencere/sekme (WebContentsView), adblocker,
  dosya sistemi ve IPC'yi yönetir. Renderer yalnızca UI kabuğudur
  (`contextIsolation: true`, `nodeIntegration: false`, preload köprüsü).
- **Local-first:** Hiçbir veri buluta gitmez. Her şey `~/Wisp/` altındadır:

```
~/Wisp/
  config.json                 # global ayarlar (tema, adblock, profil)
  rooms/
    <oda>/
      room.json               # oda meta + açık sekmeler
      notes/*.md              # notlar (Obsidian uyumlu markdown)
      sources.json            # toplanan kaynaklar + metadata
      map.json                # kavram düğümleri + bağlar
      clips/                  # klipslenen görseller/sayfalar
```

- **Tek graph, üç görünüm:** Kaynak kartı, notlardaki `[[wikilink]]` ve harita
  düğümü aynı nesnenin üç görünümüdür; altta tek veri modeli (nodes + edges) yatar.

## Fazlar

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 0 | İskele + kimlik | ✅ |
| 1 | Tarayıcı çekirdeği + oda sistemi | ⏳ |
| 2 | Temiz arama şeridi | ⏳ |
| 3 | Adblocker + reader + klip | ⏳ |
| 4 | Notlar | ⏳ |
| 5 | Kavram haritası | ⏳ |
| 6 | Araştırma araçları | ⏳ |
| 7 | Cila + paketleme | ⏳ |

## Bilinen sınırlamalar

- Gerçek Chrome extension API'si yok.
- Tam multi-process sandbox güvenliği hedeflenmedi (Electron varsayılanları +
  contextIsolation kullanılır).
- Bulut senkronizasyonu ve mobil sürüm kapsam dışı.
