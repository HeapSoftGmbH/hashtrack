import type { Catalog } from "@opencode/plugin/gui";

/**
 * The plugin's copy in every language OpenCode's interface ships: 63 locales,
 * keyed by the interface locale codes OpenCode stores (`de`, `zh`, `zht`).
 * English fills any key a locale lacks, so a partial catalog stays correct.
 */
export const catalog: Catalog = {
	en: {
		openDashboard: "Open the hashtrack dashboard",
		commandTitle: "Hashtrack: open dashboard",
		commandDescription:
			"Show detailed token and cost stats for this repository",
		openFailed: "Could not open the dashboard: {{error}}",
	},
	zh: {
		openDashboard: "打开 Hashtrack 仪表板",
		commandTitle: "Hashtrack：打开仪表板",
		commandDescription: "显示此仓库的详细令牌和费用统计",
		openFailed: "无法打开仪表板：{{error}}",
	},
	zht: {
		openDashboard: "開啟 Hashtrack 儀表板",
		commandTitle: "Hashtrack：開啟儀表板",
		commandDescription: "顯示此儲存庫的詳細權杖與費用統計",
		openFailed: "無法開啟儀表板：{{error}}",
	},
	ko: {
		openDashboard: "Hashtrack 대시보드 열기",
		commandTitle: "Hashtrack: 대시보드 열기",
		commandDescription: "이 저장소의 자세한 토큰 및 비용 통계 표시",
		openFailed: "대시보드를 열 수 없습니다: {{error}}",
	},
	de: {
		openDashboard: "Hashtrack-Dashboard öffnen",
		commandTitle: "Hashtrack: Dashboard öffnen",
		commandDescription:
			"Detaillierte Token- und Kostenstatistik für dieses Repository anzeigen",
		openFailed: "Dashboard konnte nicht geöffnet werden: {{error}}",
	},
	es: {
		openDashboard: "Abrir el panel de Hashtrack",
		commandTitle: "Hashtrack: abrir panel",
		commandDescription:
			"Mostrar estadísticas detalladas de tokens y costes de este repositorio",
		openFailed: "No se pudo abrir el panel: {{error}}",
	},
	fr: {
		openDashboard: "Ouvrir le tableau de bord Hashtrack",
		commandTitle: "Hashtrack : ouvrir le tableau de bord",
		commandDescription:
			"Afficher les statistiques détaillées de jetons et de coûts de ce dépôt",
		openFailed: "Impossible d’ouvrir le tableau de bord : {{error}}",
	},
	da: {
		openDashboard: "Åbn Hashtrack-dashboardet",
		commandTitle: "Hashtrack: åbn dashboard",
		commandDescription:
			"Vis detaljeret statistik over tokens og omkostninger for dette repository",
		openFailed: "Dashboardet kunne ikke åbnes: {{error}}",
	},
	ja: {
		openDashboard: "Hashtrack ダッシュボードを開く",
		commandTitle: "Hashtrack: ダッシュボードを開く",
		commandDescription: "このリポジトリの詳細なトークンとコストの統計を表示",
		openFailed: "ダッシュボードを開けませんでした: {{error}}",
	},
	pl: {
		openDashboard: "Otwórz panel Hashtrack",
		commandTitle: "Hashtrack: otwórz panel",
		commandDescription:
			"Pokaż szczegółowe statystyki tokenów i kosztów tego repozytorium",
		openFailed: "Nie udało się otworzyć panelu: {{error}}",
	},
	ru: {
		openDashboard: "Открыть панель Hashtrack",
		commandTitle: "Hashtrack: открыть панель",
		commandDescription:
			"Показать подробную статистику токенов и затрат для этого репозитория",
		openFailed: "Не удалось открыть панель: {{error}}",
	},
	uk: {
		openDashboard: "Відкрити панель Hashtrack",
		commandTitle: "Hashtrack: відкрити панель",
		commandDescription:
			"Показати докладну статистику токенів і витрат для цього репозиторію",
		openFailed: "Не вдалося відкрити панель: {{error}}",
	},
	bs: {
		openDashboard: "Otvori Hashtrack nadzornu ploču",
		commandTitle: "Hashtrack: otvori nadzornu ploču",
		commandDescription:
			"Prikaži detaljnu statistiku tokena i troškova za ovaj repozitorij",
		openFailed: "Nadzornu ploču nije moguće otvoriti: {{error}}",
	},
	ar: {
		openDashboard: "فتح لوحة Hashtrack",
		commandTitle: "Hashtrack: فتح لوحة المعلومات",
		commandDescription: "عرض إحصاءات تفصيلية للرموز والتكاليف لهذا المستودع",
		openFailed: "تعذّر فتح لوحة المعلومات: {{error}}",
	},
	he: {
		openDashboard: "פתיחת לוח הבקרה של Hashtrack",
		commandTitle: "Hashtrack: פתיחת לוח הבקרה",
		commandDescription:
			"הצגת סטטיסטיקות מפורטות של אסימונים ועלויות עבור מאגר זה",
		openFailed: "לא ניתן לפתוח את לוח הבקרה: {{error}}",
	},
	no: {
		openDashboard: "Åpne Hashtrack-dashbordet",
		commandTitle: "Hashtrack: åpne dashbord",
		commandDescription:
			"Vis detaljert statistikk over tokens og kostnader for dette repositoriet",
		openFailed: "Kunne ikke åpne dashbordet: {{error}}",
	},
	br: {
		openDashboard: "Abrir o painel do Hashtrack",
		commandTitle: "Hashtrack: abrir painel",
		commandDescription:
			"Mostrar estatísticas detalhadas de tokens e custos deste repositório",
		openFailed: "Não foi possível abrir o painel: {{error}}",
	},
	th: {
		openDashboard: "เปิดแดชบอร์ด Hashtrack",
		commandTitle: "Hashtrack: เปิดแดชบอร์ด",
		commandDescription: "แสดงสถิติโดยละเอียดของโทเค็นและค่าใช้จ่ายสำหรับที่เก็บนี้",
		openFailed: "ไม่สามารถเปิดแดชบอร์ดได้: {{error}}",
	},
	tr: {
		openDashboard: "Hashtrack panosunu aç",
		commandTitle: "Hashtrack: panoyu aç",
		commandDescription:
			"Bu depo için ayrıntılı token ve maliyet istatistiklerini göster",
		openFailed: "Pano açılamadı: {{error}}",
	},
	hi: {
		openDashboard: "Hashtrack डैशबोर्ड खोलें",
		commandTitle: "Hashtrack: डैशबोर्ड खोलें",
		commandDescription: "इस रिपॉज़िटरी के विस्तृत टोकन और लागत आँकड़े दिखाएँ",
		openFailed: "डैशबोर्ड खोल नहीं सका: {{error}}",
	},
	nl: {
		openDashboard: "Hashtrack-dashboard openen",
		commandTitle: "Hashtrack: dashboard openen",
		commandDescription:
			"Gedetailleerde token- en kostenstatistieken voor deze repository tonen",
		openFailed: "Kan het dashboard niet openen: {{error}}",
	},
	id: {
		openDashboard: "Buka dasbor Hashtrack",
		commandTitle: "Hashtrack: buka dasbor",
		commandDescription:
			"Tampilkan statistik token dan biaya terperinci untuk repositori ini",
		openFailed: "Tidak dapat membuka dasbor: {{error}}",
	},
	vi: {
		openDashboard: "Mở bảng điều khiển Hashtrack",
		commandTitle: "Hashtrack: mở bảng điều khiển",
		commandDescription:
			"Hiển thị số liệu thống kê chi tiết về token và chi phí của kho lưu trữ này",
		openFailed: "Không thể mở bảng điều khiển: {{error}}",
	},
	it: {
		openDashboard: "Apri la dashboard di Hashtrack",
		commandTitle: "Hashtrack: apri dashboard",
		commandDescription:
			"Mostra statistiche dettagliate su token e costi per questo repository",
		openFailed: "Impossibile aprire la dashboard: {{error}}",
	},
	ur: {
		openDashboard: "Hashtrack ڈیش بورڈ کھولیں",
		commandTitle: "Hashtrack: ڈیش بورڈ کھولیں",
		commandDescription:
			"اس ریپوزٹری کے تفصیلی ٹوکن اور لاگت کے اعداد و شمار دکھائیں",
		openFailed: "ڈیش بورڈ کھولا نہیں جا سکا: {{error}}",
	},
	pa: {
		openDashboard: "Hashtrack ڈیش بورڈ کھولو",
		commandTitle: "Hashtrack: ڈیش بورڈ کھولو",
		commandDescription:
			"ایس ریپوزٹری دے تفصیلی ٹوکن تے لاگت دے اعداد و شمار وکھاؤ",
		openFailed: "ڈیش بورڈ کھول نئیں سکیا: {{error}}",
	},
	az: {
		openDashboard: "Hashtrack idarə panelini aç",
		commandTitle: "Hashtrack: idarə panelini aç",
		commandDescription:
			"Bu repozitoriya üçün ətraflı token və xərc statistikasını göstər",
		openFailed: "İdarə panelini açmaq mümkün olmadı: {{error}}",
	},
	fi: {
		openDashboard: "Avaa Hashtrack-koontinäkymä",
		commandTitle: "Hashtrack: avaa koontinäkymä",
		commandDescription:
			"Näytä tämän tietovaraston yksityiskohtaiset token- ja kustannustilastot",
		openFailed: "Koontinäkymää ei voitu avata: {{error}}",
	},
	sv: {
		openDashboard: "Öppna Hashtrack-instrumentpanelen",
		commandTitle: "Hashtrack: öppna instrumentpanelen",
		commandDescription:
			"Visa detaljerad statistik över tokens och kostnader för detta repo",
		openFailed: "Det gick inte att öppna instrumentpanelen: {{error}}",
	},
	am: {
		openDashboard: "የHashtrack ዳሽቦርድ ክፈት",
		commandTitle: "Hashtrack: ዳሽቦርድ ክፈት",
		commandDescription: "የዚህ ማከማቻ ዝርዝር የቶከን እና የወጪ ስታቲስቲክስ አሳይ",
		openFailed: "ዳሽቦርዱን መክፈት አልተቻለም: {{error}}",
	},
	bg: {
		openDashboard: "Отвори таблото на Hashtrack",
		commandTitle: "Hashtrack: отвори табло",
		commandDescription:
			"Покажи подробна статистика за токени и разходи за това хранилище",
		openFailed: "Таблото не може да бъде отворено: {{error}}",
	},
	bn: {
		openDashboard: "Hashtrack ড্যাশবোর্ড খুলুন",
		commandTitle: "Hashtrack: ড্যাশবোর্ড খুলুন",
		commandDescription: "এই রিপোজিটরির বিস্তারিত টোকেন ও খরচের পরিসংখ্যান দেখান",
		openFailed: "ড্যাশবোর্ড খোলা যায়নি: {{error}}",
	},
	ca: {
		openDashboard: "Obre el tauler del Hashtrack",
		commandTitle: "Hashtrack: obre el tauler",
		commandDescription:
			"Mostra estadístiques detallades de tokens i costos d'aquest repositori",
		openFailed: "No s'ha pogut obrir el tauler: {{error}}",
	},
	cs: {
		openDashboard: "Otevřít panel Hashtrack",
		commandTitle: "Hashtrack: otevřít panel",
		commandDescription:
			"Zobrazit podrobné statistiky tokenů a nákladů pro toto úložiště",
		openFailed: "Panel se nepodařilo otevřít: {{error}}",
	},
	dv: {
		openDashboard: "Hashtrack ޑޭޝްބޯޑް ހުޅުވާ",
		commandTitle: "Hashtrack: ޑޭޝްބޯޑް ހުޅުވާ",
		commandDescription: "މި ރެޕޮޒިޓަރީގެ ޓޯކަން އަދި ޚަރަދުގެ ތަފްސީލް ތަފާސްހިސާބު ދައްކާ",
		openFailed: "ޑޭޝްބޯޑް ހުޅުވޭކަށް ނުވި: {{error}}",
	},
	dz: {
		openDashboard: "Hashtrack གི་ཌེཤ་བོརཌ་ཕྱེ་ཕྱེཝ",
		commandTitle: "Hashtrack: ཌེཤ་བོརཌ་ཕྱེ་ཕྱེཝ",
		commandDescription: "མཛོད་ཁང་འདི་གི་ཊོ་ཀེན་དང་ཟད་འགྲོའི་སྡོམ་ཚིག་ཞིབ་ཕྲ་སྟོན",
		openFailed: "ཌེཤ་བོརཌ་ཕྱེ་མ་ཚུགས: {{error}}",
	},
	el: {
		openDashboard: "Άνοιγμα του πίνακα ελέγχου του Hashtrack",
		commandTitle: "Hashtrack: άνοιγμα πίνακα ελέγχου",
		commandDescription:
			"Εμφάνιση λεπτομερών στατιστικών token και κόστους για αυτό το αποθετήριο",
		openFailed: "Δεν ήταν δυνατό το άνοιγμα του πίνακα ελέγχου: {{error}}",
	},
	et: {
		openDashboard: "Ava Hashtracki juhtpaneel",
		commandTitle: "Hashtrack: ava juhtpaneel",
		commandDescription:
			"Näita selle hoidla üksikasjalikku tokeni- ja kulustatistikat",
		openFailed: "Juhtpaneeli ei saanud avada: {{error}}",
	},
	fa: {
		openDashboard: "باز کردن داشبورد Hashtrack",
		commandTitle: "Hashtrack: باز کردن داشبورد",
		commandDescription: "نمایش آمار دقیق توکن و هزینه برای این مخزن",
		openFailed: "داشبورد باز نشد: {{error}}",
	},
	fo: {
		openDashboard: "Opna Hashtrack-stýriborðið",
		commandTitle: "Hashtrack: opna stýriborð",
		commandDescription:
			"Vís gjølligari hagtøl fyri token og kostnað fyri hesa goymsluna",
		openFailed: "Stýriborðið kundi ikki opnast: {{error}}",
	},
	hr: {
		openDashboard: "Otvori Hashtrack nadzornu ploču",
		commandTitle: "Hashtrack: otvori nadzornu ploču",
		commandDescription:
			"Prikaži detaljnu statistiku tokena i troškova za ovaj repozitorij",
		openFailed: "Nadzornu ploču nije moguće otvoriti: {{error}}",
	},
	hu: {
		openDashboard: "Hashtrack irányítópult megnyitása",
		commandTitle: "Hashtrack: irányítópult megnyitása",
		commandDescription:
			"Részletes token- és költségstatisztika megjelenítése ehhez a repóhoz",
		openFailed: "Nem sikerült megnyitni az irányítópultot: {{error}}",
	},
	hy: {
		openDashboard: "Բացել Hashtrack-ի վահանակը",
		commandTitle: "Hashtrack: բացել վահանակը",
		commandDescription:
			"Ցուցադրել այս պահոցի թոքենների և ծախսերի մանրամասն վիճակագրությունը",
		openFailed: "Չհաջողվեց բացել վահանակը՝ {{error}}",
	},
	is: {
		openDashboard: "Opna Hashtrack-mælaborðið",
		commandTitle: "Hashtrack: opna mælaborð",
		commandDescription:
			"Sýna ítarlegar tölfræði um tákn og kostnað fyrir þetta geymslu",
		openFailed: "Ekki tókst að opna mælaborðið: {{error}}",
	},
	ka: {
		openDashboard: "Hashtrack-ის დაფის გახსნა",
		commandTitle: "Hashtrack: დაფის გახსნა",
		commandDescription:
			"ამ რეპოზიტორიის ტოკენებისა და ხარჯების დეტალური სტატისტიკის ჩვენება",
		openFailed: "დაფის გახსნა ვერ მოხერხდა: {{error}}",
	},
	km: {
		openDashboard: "បើកផ្ទាំងគ្រប់គ្រង Hashtrack",
		commandTitle: "Hashtrack: បើកផ្ទាំងគ្រប់គ្រង",
		commandDescription: "បង្ហាញស្ថិតិលម្អិតអំពីតូខេន និងថ្លៃដើមសម្រាប់ឃ្លាំងនេះ",
		openFailed: "មិនអាចបើកផ្ទាំងគ្រប់គ្រងបានទេ: {{error}}",
	},
	lo: {
		openDashboard: "ເປີດແດຊບອດ Hashtrack",
		commandTitle: "Hashtrack: ເປີດແດຊບອດ",
		commandDescription: "ສະແດງສະຖິຕິໂທເຄັນ ແລະ ຄ່າໃຊ້ຈ່າຍແບບລະອຽດຂອງບ່ອນເກັບນີ້",
		openFailed: "ບໍ່ສາມາດເປີດແດຊບອດໄດ້: {{error}}",
	},
	lt: {
		openDashboard: "Atidaryti „Hashtrack“ valdymo skydelį",
		commandTitle: "Hashtrack: atidaryti valdymo skydelį",
		commandDescription:
			"Rodyti išsamią šios saugyklos žetonų ir išlaidų statistiką",
		openFailed: "Nepavyko atidaryti valdymo skydelio: {{error}}",
	},
	lv: {
		openDashboard: "Atvērt Hashtrack informācijas paneli",
		commandTitle: "Hashtrack: atvērt informācijas paneli",
		commandDescription:
			"Rādīt detalizētu šīs krātuves marķieru un izmaksu statistiku",
		openFailed: "Nevarēja atvērt informācijas paneli: {{error}}",
	},
	mk: {
		openDashboard: "Отвори ја таблата на Hashtrack",
		commandTitle: "Hashtrack: отвори табла",
		commandDescription:
			"Прикажи детална статистика за токени и трошоци за ова складиште",
		openFailed: "Таблата не може да се отвори: {{error}}",
	},
	mn: {
		openDashboard: "Hashtrack-ийн хянах самбарыг нээх",
		commandTitle: "Hashtrack: хянах самбар нээх",
		commandDescription:
			"Энэ репозиторийн токен болон зардлын дэлгэрэнгүй статистикийг харуулах",
		openFailed: "Хянах самбарыг нээж чадсангүй: {{error}}",
	},
	ms: {
		openDashboard: "Buka papan pemuka Hashtrack",
		commandTitle: "Hashtrack: buka papan pemuka",
		commandDescription:
			"Tunjukkan statistik token dan kos terperinci untuk repositori ini",
		openFailed: "Tidak dapat membuka papan pemuka: {{error}}",
	},
	my: {
		openDashboard: "Hashtrack ဒက်ရှ်ဘုတ်ကို ဖွင့်ပါ",
		commandTitle: "Hashtrack: ဒက်ရှ်ဘုတ် ဖွင့်ပါ",
		commandDescription: "ဤသိုလှောင်ရုံအတွက် တိုကင်နှင့် ကုန်ကျစရိတ် အသေးစိတ် စာရင်းအင်းများကို ပြပါ",
		openFailed: "ဒက်ရှ်ဘုတ်ကို ဖွင့်၍မရပါ: {{error}}",
	},
	ne: {
		openDashboard: "Hashtrack ड्यासबोर्ड खोल्नुहोस्",
		commandTitle: "Hashtrack: ड्यासबोर्ड खोल्नुहोस्",
		commandDescription: "यो रिपोजिटरीको विस्तृत टोकन र लागत तथ्याङ्क देखाउनुहोस्",
		openFailed: "ड्यासबोर्ड खोल्न सकिएन: {{error}}",
	},
	ro: {
		openDashboard: "Deschide panoul Hashtrack",
		commandTitle: "Hashtrack: deschide panoul",
		commandDescription:
			"Afișează statistici detaliate despre tokenuri și costuri pentru acest depozit",
		openFailed: "Panoul nu a putut fi deschis: {{error}}",
	},
	si: {
		openDashboard: "Hashtrack උපකරණ පුවරුව විවෘත කරන්න",
		commandTitle: "Hashtrack: උපකරණ පුවරුව විවෘත කරන්න",
		commandDescription: "මෙම ගබඩාව සඳහා ටෝකන් සහ පිරිවැය පිළිබඳ සවිස්තර සංඛ්‍යාලේඛන පෙන්වන්න",
		openFailed: "උපකරණ පුවරුව විවෘත කළ නොහැකි විය: {{error}}",
	},
	sk: {
		openDashboard: "Otvoriť panel Hashtrack",
		commandTitle: "Hashtrack: otvoriť panel",
		commandDescription:
			"Zobraziť podrobné štatistiky tokenov a nákladov pre toto úložisko",
		openFailed: "Panel sa nepodarilo otvoriť: {{error}}",
	},
	sl: {
		openDashboard: "Odpri nadzorno ploščo Hashtrack",
		commandTitle: "Hashtrack: odpri nadzorno ploščo",
		commandDescription:
			"Prikaži podrobno statistiko žetonov in stroškov za to shrambo",
		openFailed: "Nadzorne plošče ni bilo mogoče odpreti: {{error}}",
	},
	sq: {
		openDashboard: "Hap panelin e Hashtrack",
		commandTitle: "Hashtrack: hap panelin",
		commandDescription:
			"Shfaq statistika të detajuara të tokenëve dhe kostove për këtë depo",
		openFailed: "Paneli nuk mund të hapej: {{error}}",
	},
	sr: {
		openDashboard: "Отвори Hashtrack таблу",
		commandTitle: "Hashtrack: отвори таблу",
		commandDescription:
			"Прикажи детаљну статистику токена и трошкова за ово складиште",
		openFailed: "Табла није могла да се отвори: {{error}}",
	},
	tg: {
		openDashboard: "Кушодани лавҳаи Hashtrack",
		commandTitle: "Hashtrack: кушодани лавҳа",
		commandDescription:
			"Нишон додани омори муфассали токенҳо ва хароҷот барои ин анбор",
		openFailed: "Лавҳаро кушодан муяссар нашуд: {{error}}",
	},
	tk: {
		openDashboard: "Hashtrack panelini aç",
		commandTitle: "Hashtrack: paneli aç",
		commandDescription:
			"Bu saklawy üçin jikme-jik token we çykdajy statistikasyny görkez",
		openFailed: "Paneli açyp bolmady: {{error}}",
	},
	uz: {
		openDashboard: "Hashtrack panelini ochish",
		commandTitle: "Hashtrack: panelni ochish",
		commandDescription:
			"Ushbu repozitoriy uchun token va xarajat statistikasini batafsil ko‘rsatish",
		openFailed: "Panelni ochib bo‘lmadi: {{error}}",
	},
};
