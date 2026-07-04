// Wisp — © Shawy404. All rights reserved.
import type { Lang } from './i18n'

/**
 * Human-written release notes, newest first. Shown in Settings → Updates and
 * by the update banner's "what's new" view. GitHub release bodies stay the
 * canonical source for the updater itself; this list is the offline copy so
 * the log is readable even before (or without) a release check.
 */
export interface ChangelogEntry {
  version: string
  date: string
  notes: Record<Lang, string[]>
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.5-pre-alpha',
    date: '2026-07-04',
    notes: {
      tr: [
        'Uygulamanın açılışta siyah ekranda kalmasına yol açan hata giderildi.',
        'Güncellemeler artık uygulamanın içinde iniyor: kurulum penceresi açılmadan, wisp animasyonlu bir ilerleme menüsüyle iner ve yeniden başlatınca kurulur. Güncellemek tamamen senin seçimin.',
        'Açılış animasyonu artık her açılışta güvenilir biçimde görünüyor.',
        'Panel butonlarını (ayarlar, indirilenler, şifreler vb.) tutup kenar çubuğu ile üst çubuk arasında sürükleyebiliyorsun; ayarlardan da yerleri değişiyor.',
        'Split view yenilendi: her iki pano da ayrı ayrı Sayfa / Okuyucu / Not / Kaynaklar gösterebiliyor. Bir sekmeyi kenara sürükleyince canlı sayfa bir yanda, not diğer yanda açılıyor.',
        'Ayarlara her sürümde ne değiştiğini gösteren sürüm notları bölümü eklendi.'
      ],
      en: [
        'Fixed a bug that could leave the app stuck on a black screen at startup.',
        'Updates now download inside the app: a wisp-animated progress menu, no installer window, and it installs on restart. Updating is entirely your choice.',
        'The startup animation now shows reliably on every launch.',
        'Panel buttons (settings, downloads, vault, and the rest) can be dragged between the sidebar rail and the title bar; you can also move them from settings.',
        'Split view reworked: each pane independently shows Page / Reader / Note / Sources. Drag a tab to an edge to get the live page on one side and a note on the other.',
        'Added a release-notes section in settings that lists what changed in each version.'
      ]
    }
  },
  {
    version: '0.1.4-pre-alpha',
    date: '2026-07-04',
    notes: {
      tr: [
        'Compact mod: kenar çubuğu kullanılmadığında kenara çekilir, fare sol kenara gelince geri açılır (Ayarlar → Görünüm).',
        'Essentials: tüm odalarda görünen kalıcı sekmeler — sekmeye sağ tıklayıp ekleyebilirsin; oda sabitlemeleri odaya özel kalır.',
        'Notlarda backlink paneli: bir nota bağlanan diğer notlar editörün altında listelenir; linksiz geçen not adları tek tıkla [[link]]e çevrilir.',
        'Sekmeyi görüntü alanının sağına/soluna sürükleyip bırakınca split view açılır.',
        'Ayarlara güncelleme bölümü geldi: otomatik güncelleme aç/kapat, elle kontrol ve bu sürüm notları.',
        'Bellek ayarları: arka plan sekmelerinin ne kadar sürede uyutulacağı seçilebilir.',
        'RAM göstergesi düzeltildi — artık gerçek kullanımını gösteriyor (paylaşılan bellek çift sayılmıyor, önbellek dolu sayılmıyor.)',
        'Alt ray sadeleşti: geçmiş butonu kaldırıldı (Ctrl+H ve komut paleti), butonlar içerik/sistem olarak gruplandı; sistem grubu istersen üst çubuğa taşınabilir.',
        'Uygulama açılışına ve aramaya küçük wisp animasyonları eklendi.',
        'Yapay zekâ ile ilgili her şey kaldırıldı — API anahtarı yok, dışarı veri gitmiyor.'
      ],
      en: [
        'Compact mode: the sidebar tucks itself away and glides back when the pointer nears the left edge (Settings → Appearance).',
        'Essentials: tabs that follow you into every room — add via right-click; room pins stay per-room.',
        'Backlinks panel in notes: everything linking to the open note is listed under the editor; unlinked title mentions can be converted to [[links]] in one click.',
        'Drag a tab to the left/right edge of the viewport to open split view.',
        'New Updates section in Settings: auto-update toggle, manual check and these release notes.',
        'Memory settings: choose how long background tabs may idle before being unloaded.',
        'RAM meter fixed — it now reports real usage (shared memory no longer double-counted, page cache no longer counted as used).',
        'The bottom rail was decluttered: history moved to Ctrl+H / the palette, buttons grouped into content/system; the system group can move to the title bar.',
        'Little wisp animations on app start and while searching.',
        'Everything AI-related was removed — no API keys, nothing leaves your machine.'
      ]
    }
  },
  {
    version: '0.1.3-pre-alpha',
    date: '2026-07-02',
    notes: {
      tr: [
        'Windows için otomatik güncelleyici: yeni sürüm arkada iner, yeniden başlatınca kurulur.',
        'Kenar çubuğuna müzik ve RAM mini widget’ları geldi.',
        'Odaklanma zamanlayıcısının süresi ayarlanabilir oldu.',
        'Kavram haritasına sürüm geçmişi eklendi — eski hâline dönebilirsin.'
      ],
      en: [
        'Auto-updater on Windows: new versions download in the background and install on restart.',
        'Music and RAM mini widgets in the sidebar.',
        'The focus timer length is adjustable.',
        'The concept map got version history — roll back anytime.'
      ]
    }
  },
  {
    version: '0.1.2-pre-alpha',
    date: '2026-06-28',
    notes: {
      tr: [
        'Bölüm klipsleme: sayfanın bir kısmını odaya kaydet, kaynağı açınca vurgulu görünsün.',
        'Oda bazlı gezinme geçmişi ve aranabilir geçmiş paneli.',
        'İndirme yöneticisi ve yt-dlp ile video klipleme.',
        'Sayfada bul (Ctrl+F), oda içi tam metin arama (Ctrl+Shift+F).',
        'Şifre kasası: otomatik yakalama ve doldurma.'
      ],
      en: [
        'Section clipping: save part of a page into the room, highlighted when reopened.',
        'Per-room browsing history with a searchable panel.',
        'Download manager and video clipping via yt-dlp.',
        'Find in page (Ctrl+F), room-wide full-text search (Ctrl+Shift+F).',
        'Password vault with auto-capture and autofill.'
      ]
    }
  },
  {
    version: '0.1.1-pre-alpha',
    date: '2026-06-20',
    notes: {
      tr: [
        'Öğe silici (zapper): sayfadaki istenmeyen öğeleri kalıcı gizle.',
        'Arka plan görseli ve Zen tarzı yarı saydam arayüz.',
        'Kavram haritası açık bağlantılar (wikilink/manuel) etrafında yeniden kuruldu.',
        'Yeni uygulama ikonu ve altı tema.'
      ],
      en: [
        'Element zapper: permanently hide unwanted page elements.',
        'Background images and Zen-style translucent UI.',
        'The concept map was rebuilt around explicit links (wikilinks/manual).',
        'New app icon and six themes.'
      ]
    }
  },
  {
    version: '0.1.0-pre-alpha',
    date: '2026-06-12',
    notes: {
      tr: [
        'İlk sürüm: odalar, araştırma araması, notlar, kavram haritası, okuyucu ve reklam engelleme.'
      ],
      en: [
        'First release: rooms, research search, notes, the concept map, reader mode and adblock.'
      ]
    }
  }
]

/** Notes for one version (without the -pre-alpha suffix fuss), if we have them. */
export function changelogFor(version: string): ChangelogEntry | null {
  const bare = version.replace(/^v/, '').split('-')[0]
  return CHANGELOG.find((e) => e.version.split('-')[0] === bare) ?? null
}
