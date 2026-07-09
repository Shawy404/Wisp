// Wisp. © Shawy404, MIT.
import type { Lang } from './i18n'

// the actual changelog, written by me, not a robot. newest first. this shows up
// in Settings under release notes and in the little "what's new" popup when an
// update lands. the github release notes are the real source for the updater,
// this is just the offline copy so you can read it without checking online.
export interface ChangelogEntry {
  version: string
  date: string
  notes: Record<Lang, string[]>
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.0-pre-alpha',
    date: '2026-07-09',
    notes: {
      tr: [
        'odalar silmek yerine arşivlenebiliyor. yeni oda açar gibi +\'ya bas, arşivdekiler orada bekliyor.',
        'harita ciddileşti: düğümleri saran ve beraber taşınan adlı çerçeveler, gerçek metnini gösteren not kartları, artık gerçekten kavisli çizgiler, küme başına renk halesi ve bir arama kutusu. bir de her şeyi tek üzgün sütuna dizmeyi bıraktı (tek satırlık bir buğdu, bir akşamımı yedi).',
        'çerçeveler de shift+tık ile kavramlara bağlanıyor, herkes gibi.',
        'nota # yazınca odanın etiketleri açılıyor. birini seç, aynı etiketi taşıyan notlar haritada kendiliğinden bağlanıyor.',
        'bağlantıyı yeni sekmede aç artık arkada açıyor. sen okumaya devam, sekme bekler. arama sonuçlarında da var, sağ tıkla.',
        'adres çubuğu aramalarını hatırlıyor, yazarken geçmişteki sayfalarla karıştırıp öneriyor.',
        'ilk açılış önce dilini, sonra arama motorunu soruyor.',
        'ayarlar sol üstteki maskotun altına taşındı. alt bar gitti. küçük adama tıkla.',
        'compact mod iki ayrı anahtar oldu, kenar çubuğu ve üst çubuk, ikisi de kendi başına.',
        'cam meselesi çözüldü: duvar kağıdı varken panellerin arkası kapalı, okuyabiliyorsun; gerçek pencere şeffaflığında duvar kağıdı kenara çekiliyor ve masaüstün görünüyor.',
        'uygulama ikonunu ayarlardan değiştirebiliyorsun, aynı duvar kağıdını iki kez seçmek artık kopya üretmiyor (dokuz kopya vardı. dokuz.).',
        'klipler sayfanın tam o noktasında, kaydettiğin bölümün tamamı işaretli açılıyor.',
        'güncelleme notları ham markdown yerine düzgün görünüyor.',
        'kaydırma çubukları sayfanın üstünde yüzüyor, iş bitince kayboluyor.',
        'dev moduna ayarlarda bir test tezgahı geldi, turu tekrar oynat ya da güncelleme akışını dene.',
        'maskot filigranı ve shift+F11 gitti. ikisini de özleyen olmayacak.'
      ],
      en: [
        "rooms can be archived instead of deleted. hit + like you're making a new room, the archived ones are right there waiting.",
        "the map got serious: named frames that group nodes and move together, note cards that show the actual text, every line curves properly, clusters get their own halo, and there's a find box. also it stopped laying everything out in one sad column (a one line bug that ate my evening).",
        'frames link to concepts with shift+click like everything else.',
        "type # in a note and the room's tags pop up. pick one and matching notes connect on the map by themselves.",
        'open link in new tab opens in the background now. you keep reading, the tab waits. search results too, right click one.',
        'the address bar remembers your searches and mixes in pages from history while you type.',
        'first launch asks your language, then your search engine.',
        'settings moved under the mascot in the top left. the bottom bar is gone. click the little guy.',
        'compact mode is two switches now, sidebar and toolbar, each on its own.',
        'glass got sorted: with a wallpaper set the panels keep a solid back so you can read them, with real window transparency the wallpaper steps aside and your desktop shows through.',
        "you can change the app icon from settings, and importing the same wallpaper twice doesn't duplicate it anymore (nine copies. i had nine).",
        'clips reopen at the exact spot with the whole saved section highlighted.',
        'update notes render like actual notes instead of raw markdown.',
        'scrollbars float over pages and fade away when you stop scrolling.',
        'dev mode grew a test bench in settings, replay the tour or demo the update flow.',
        'the mascot watermark and shift+F11 are gone. neither will be missed.'
      ]
    }
  },
  {
    version: '0.1.7-pre-alpha',
    date: '2026-07-05',
    notes: {
      tr: [
        'split view artık 2 farklı sayfayı gerçekten canlı gösteriyor, yan yana. ortadaki çizgiyi tutup panoların boyutunu değiştirebiliyorsun. (uğraşırken ellerim kırılacaktı)',
        'essentials ve pinler tek şey oldu. bir sekmeyi essentials yap, her odada çıksın. sağ tıkla sadece bu odadan, ya da hepsinden kaldır.',
        'sayfaya zoom geldi. trackpad’de pinch yap, ya da Ctrl+tekerlek, Ctrl ve +/-, Ctrl+0 sıfırlar.',
        'ilk açılış introsundan sonra küçük bir sürpriz var. git bul.',
        'compact kenar çubuğu artık sayfa açıkken de açılıyor, mouse’u sola doğru it yeter.',
        'müzik olayı sadece bir şey çalarken görünüyor artık, boşuna “nothing playing” yazısına bakmak yok.',
        'ayarlara arama ve sekmeler geldi, tek uzun liste değil. kaybolursan bir de “nasıl çalışır” kısmı koydum.',
        'wisp artık mit. yani fuck around and find out. projende adım geçerse mutlu olurum.'
      ],
      en: [
        'split view actually shows two different live pages side by side now. grab the line in the middle to resize the panes. (this one nearly broke my hands)',
        'essentials and pins are one thing now. make a tab essential and it follows you into every room. right click to yeet it from just this room, or from all of them.',
        'added page zoom. pinch on the trackpad, or Ctrl+wheel, or Ctrl and +/-, and Ctrl+0 to reset.',
        "there's a little surprise after the first run intro. go find it.",
        'the compact sidebar opens even when a page is covering it now. just shove the mouse to the left edge.',
        "the music thing only shows up when something's actually playing. no more staring at 'nothing playing'.",
        "settings got a search box and tabs so it's not one endless scroll. also a 'how it works' bit if you get lost.",
        'wisp is MIT now. so, fuck around and find out. if my name shows up somewhere in your project that would make me happy.'
      ]
    }
  },
  {
    version: '0.1.6-pre-alpha',
    date: '2026-07-04',
    notes: {
      tr: [
        'split view iki farklı canlı sayfayı yan yana açabiliyor. her panoyu ayrı ayrı Sayfa / Okuyucu / Not / Kaynaklar yapabilirsin.',
        'ayarlara arama kutusu ve sekmeler koydum, tek uzun liste yerine.',
        'ayarlar butonu sağ alt köşeye geçti, her sayfanın üstünde tek tık.',
        'açılış animasyonunu daha sağlam yaptım, pencere şeffafken bile görünüyor.',
        'sekmeye sağ tık menüsü artık sayfanın arkasında kaybolmuyor.',
        'panel butonlarını kenar çubuğu ile üst çubuk arasında sürükleyebiliyorsun.'
      ],
      en: [
        'split view can show two different live pages side by side. set each pane to Page / Reader / Note / Sources.',
        'put a search box and tabs in settings instead of one giant scroll.',
        'settings button moved to the bottom right so it is always one click away over any page.',
        'made the startup animation more solid, it shows even with window transparency on.',
        'the right click menu on a tab does not vanish behind the page anymore.',
        'you can drag the panel buttons between the sidebar and the title bar.'
      ]
    }
  },
  {
    version: '0.1.5-pre-alpha',
    date: '2026-07-04',
    notes: {
      tr: [
        'açılışta siyah ekranda kalma sorununu çözdüm. (özür, o benim hatamdı)',
        'güncellemeler artık uygulamanın içinde iniyor, kurulum penceresi falan açılmıyor, bitince yeniden başlatınca kuruluyor. güncellemek senin seçimin.',
        'açılış animasyonu artık her seferinde çıkıyor.',
        'split view yenilendi, her pano ayrı içerik gösterebiliyor.',
        'ayarlara her sürümde ne değiştiğini gösteren bir kısım koydum.'
      ],
      en: [
        'fixed the thing where it got stuck on a black screen at startup. (sorry, that one was on me)',
        'updates download inside the app now, no installer window popping up, installs when you restart. updating is your call.',
        'the startup animation actually shows up every time now.',
        'reworked split view so each pane can show its own thing.',
        'added a spot in settings that lists what changed in each version.'
      ]
    }
  },
  {
    version: '0.1.4-pre-alpha',
    date: '2026-07-04',
    notes: {
      tr: [
        'compact mod: kenar çubuğu kullanılmadığında kenara çekiliyor, mouse’u sola götürünce açılıyor.',
        'essentials: her odada duran sekmeler. sekmeye sağ tıklayıp ekle.',
        'notlarda backlink paneli, bir nota kimlerin bağlandığını altta gösteriyor. linksiz geçen isimleri tek tıkla linkliyorsun.',
        'sekmeyi ekranın kenarına sürükleyince split view açılıyor.',
        'ayarlara güncelleme kısmı geldi. bellek ayarları da var, sekmeler ne kadar sonra uyusun seçebiliyorsun.',
        'RAM göstergesini düzelttim, artık gerçek kullanımı gösteriyor.',
        'alt rayı sadeleştirdim, geçmiş butonu Ctrl+H ve komut paletine taşındı.',
        'yapay zekayla ilgili ne varsa söktüm. api anahtarı yok, dışarı hiçbir şey gitmiyor.'
      ],
      en: [
        'compact mode: the sidebar tucks away when you are not using it and pops back when the mouse goes left.',
        'essentials: tabs that stick around in every room. right click a tab to add one.',
        'backlinks panel in notes shows who links to the open note. and it links unlinked mentions with one click.',
        'drag a tab to the edge of the screen to open split view.',
        'settings got an updates section. also memory settings, you pick how long before background tabs go to sleep.',
        'fixed the RAM meter, it shows real usage now.',
        'cleaned up the bottom rail, history moved to Ctrl+H and the command palette.',
        'ripped out everything AI. no api keys, nothing leaves your machine.'
      ]
    }
  },
  {
    version: '0.1.3-pre-alpha',
    date: '2026-07-02',
    notes: {
      tr: [
        'windows için otomatik güncelleyici. yeni sürüm arkada iniyor, yeniden başlatınca kuruluyor.',
        'kenar çubuğuna müzik ve RAM göstergeleri koydum.',
        'odaklanma zamanlayıcısının süresi ayarlanabiliyor.',
        'kavram haritasına sürüm geçmişi geldi, eski hâline dönebiliyorsun.'
      ],
      en: [
        'auto updater for windows. new versions download in the background and install on restart.',
        'added music and RAM widgets to the sidebar.',
        'the focus timer length is adjustable now.',
        'the concept map remembers old versions so you can roll back.'
      ]
    }
  },
  {
    version: '0.1.2-pre-alpha',
    date: '2026-06-28',
    notes: {
      tr: [
        'bölüm klipsleme. sayfanın bir parçasını odaya kaydediyorsun, kaynağı açınca vurgulu görünüyor.',
        'oda bazlı gezinme geçmişi ve aranabilir geçmiş paneli.',
        'indirme yöneticisi ve yt-dlp ile video klipleme.',
        'sayfada bul (Ctrl+F), oda içinde tam metin arama (Ctrl+Shift+F).',
        'şifre kasası, otomatik yakalama ve doldurma.'
      ],
      en: [
        'section clipping. save a piece of a page into the room, it comes back highlighted.',
        'per room browsing history with a searchable panel.',
        'download manager and video clipping through yt-dlp.',
        'find in page (Ctrl+F), full text search across the room (Ctrl+Shift+F).',
        'a password vault that captures and fills logins.'
      ]
    }
  },
  {
    version: '0.1.1-pre-alpha',
    date: '2026-06-20',
    notes: {
      tr: [
        'öğe silici. sayfadaki istemediğin şeyleri kalıcı gizliyorsun.',
        'arka plan görseli ve yarı saydam arayüz.',
        'kavram haritasını açık bağlar (wikilink/manuel) üzerine yeniden kurdum.',
        'yeni ikon ve altı tema.'
      ],
      en: [
        'element zapper. hide the junk you do not want on a page, for good.',
        'background images and a translucent UI.',
        'rebuilt the concept map around explicit links (wikilinks and manual ones).',
        'new icon and six themes.'
      ]
    }
  },
  {
    version: '0.1.0-pre-alpha',
    date: '2026-06-12',
    notes: {
      tr: ['ilk sürüm. odalar, araştırma araması, notlar, kavram haritası, okuyucu ve reklam engelleme.'],
      en: ['first release. rooms, research search, notes, the concept map, reader mode and adblock.']
    }
  }
]

// notes for a version, ignoring the pre-alpha suffix nonsense.
export function changelogFor(version: string): ChangelogEntry | null {
  const bare = version.replace(/^v/, '').split('-')[0]
  return CHANGELOG.find((e) => e.version.split('-')[0] === bare) ?? null
}
