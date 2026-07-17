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
    version: '0.2.1-alpha',
    date: '2026-07-11',
    notes: {
      tr: [
        'gizli oda geldi. üstteki gözlüğe tıkla, ayrı bir odaya geçersin. oradaki sekmeler iz bırakmaz, geçmiş yazılmaz, çerez kalmaz, odayı kapatınca her şey buhar olur. maskot bu duruma hazırlıklıymış, gör bak.',
        'ayarlarda site istisnası yazarken her harften sonra kutuya tekrar tıklama devri kapandı. kutu her tuşta kendini baştan kuruyormuş. benim suçum, kusura bakma.',
        'haritada her şeyi gizleyince filtre çipleri tıklanamıyordu, "harita boş" yazısı üstlerine oturuyormuş. kalktı, çipler çalışıyor.',
        'video klipleme windows\'ta hiç çalışmamış. kod sadece / ile başlayan dosya yollarını tanıyormuş, C:\\ diye bir dünyanın varlığından habersizmiş. tanıştırdım.',
        'video siyah kalıyorsa ayarlar, genel, video kısmından donanım hızlandırmayı kapat. bazı makineler gpu ile video çözemiyor (windows, sana bakıyorum).',
        'güncelleme indirmesine duraklat geldi. duraklatınca wisp de nefesini tutuyor.',
        'indirmeler artık nereye kaydedileceğini soruyor ve her adımda haber veriyor. başladı, bitti, patladı. bildirim de sayfanın üstünde çiziliyor, önceden sayfanın arkasında kalıp kimseye görünmüyormuş (bunu kendi özelliğimi test ederken öğrendim).',
        'wisp aramasına pdf sekmesi geldi. makale pdf\'leri direkt orada.',
        'arama sonuçları türkçeye çivili olmaktan çıktı, sistemin diline bakıyor artık. türk olmayan tek kullanıcıma selamlar.',
        'timer\'a kendi süreni yazmak artık gerçekten çalışıyor. enter\'a basmak gerektiğini kimse bilmiyordu, artık tıklayıp çıkmak da yetiyor. bitince minik bir ses de çalıyor, istemeyen kapatır.',
        'herhangi bir linki sekme listesine sürükle, yeni sekmede açılır.',
        'ikon değiştirme windows\'ta hiçbir şey yapmıyordu çünkü webp seçince electron sessizce pes ediyormuş. artık png/jpeg istiyor ve dürüst.',
        'paneller, menüler ve bildirimler aynı yumuşaklıkta açılıyor artık. maskotun gözleri de var, arada kırpıyor.',
        'arayüz elden geçti: her yerdeki karakter salatası semboller yerine tek stilde çizilmiş gerçek ikonlar, uygulamayla gelen düzgün fontlar (Inter + Space Grotesk), butonlarda basınç hissi, vurgu rengini giyen kutucuklar ve kaydırıcılar, aktif sekmede renk çizgisi.',
        'kabuk da baştan çizildi: kenar çubuğu ve sayfa, vurgu renginle aydınlanan bir zeminin üstünde yüzen iki kart artık. sekmeler açılırken, kapanırken ve sıralanırken gerçekten hareket ediyor (yay fiziği, evet).',
        'sistem "daha az animasyon" diyorsa wisp de sakinleşiyor.',
        'sağ tık menüleri artık her temada tamamen opak ve hiçbir şeyin altında kalmıyor (kenar çubuğu kartı menünün kafasını kesiyormuş, özür).',
        'sayfadaki bir görsele sağ tıklayıp bilgisayara indirebilirsin, yer sorarak.',
        'odaların rengini değiştirebilirsin: oda menüsünde palet var, kendi rengini de seçebilirsin.',
        'haritada artık her düğümün boyutu değişiyor (kavram, not, kaynak, görsel): sağ tık, kaydırıcıyı sürükle, canlı büyüyüp küçülüyor. eski − / + butonları emekli.',
        'üst barın compact modu silindi. adres çubuğunu yazarken yutan, öneri listesini kırpan bir moddu, kimse özlemeyecek. kenar çubuğununki duruyor, o uslu.',
        'barlardaki buzlu cam artık bir ayar (görünüm kısmında, varsayılan kapalı). ben sevmedim ama belki seven çıkar.'
      ],
      en: [
        'a private room. click the sunglasses up top and you step into a separate room whose tabs leave no traces. no history, no cookies kept, and closing the room makes everything inside evaporate. the mascot came prepared for this, go see.',
        'typing site exceptions in settings no longer needs a click after every single letter. the box was rebuilding itself on every keystroke. my fault, sorry about that.',
        'hiding everything on the map used to make the filter chips unclickable, the "map is empty" text was sitting right on top of them. it got off, the chips work.',
        'video clipping never worked on windows. the code only recognized paths starting with /, blissfully unaware that C:\\ exists. they have been introduced.',
        'if videos stay black, settings, general, video has a switch to turn off hardware acceleration. some machines just cannot decode video on the gpu (windows, looking at you).',
        'the update download got a pause button. the wisp holds its breath while it waits.',
        'downloads ask where to save now, and announce every step. started, done, failed. the notice is also drawn above the page, it used to hide behind it where nobody could see it (i learned this while testing my own feature).',
        'wisp search grew a pdf tab. paper pdfs, right there.',
        'search results are no longer nailed to turkish, they follow your system locale now. greetings to my one non turkish user.',
        'typing your own timer length actually works now. nobody knew you had to press enter, so clicking away works too. it also chimes when the session ends, switch it off if you must.',
        'drag any link onto the tab list and it opens in a new tab.',
        'changing the app icon did nothing on windows because picking a webp made electron silently give up. it asks for png or jpeg now and tells the truth.',
        'panels, menus and toasts open with the same easing now. the mascot has eyes, and yes, it blinks.',
        'the ui got a real pass: proper icons drawn in one style instead of the unicode character salad, actual bundled fonts (Inter + Space Grotesk), buttons that press down, checkboxes and sliders wearing your accent, and a color spine on the active tab.',
        'the shell got redrawn too: the sidebar and the page are two cards floating on a floor lit by your accent color now. tabs genuinely move when they open, close and reorder (spring physics, yes).',
        'if your system asks for reduced motion, wisp calms down.',
        'right-click menus are fully opaque in every theme now and nothing sits on top of them (the sidebar card was decapitating the room menu, sorry).',
        'right-click any image on a page and save it to your computer. it asks where.',
        'rooms have changeable colors: the room menu grew a palette, plus a picker for your own.',
        "every map node is resizable now (concepts, notes, sources, photos): right-click, drag the slider, it grows live. the old − / + buttons retired.",
        "the toolbar's compact mode is deleted. it ate the address bar mid-typing and clipped the suggestions, nobody will miss it. the sidebar's compact mode stays, that one behaves.",
        'the frosted bars are a setting now (appearance, off by default). not my thing but maybe yours.'
      ]
    }
  },
  {
    version: '0.2.0-alpha',
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
        'adres çubuğu önerileri ve find bar artık üst çubuk tarafından kırpılmıyor, düzgünce altına açılıyor.',
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
        'the address bar suggestion list and the find bar stopped getting clipped off by the toolbar. they hang below it properly now.',
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
