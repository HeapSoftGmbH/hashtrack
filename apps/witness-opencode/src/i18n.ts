import type { Catalog } from "@opencode/plugin/gui";

/**
 * The plugin's copy in every language OpenCode's interface ships: 63 locales,
 * keyed by the interface locale codes OpenCode stores (`de`, `zh`, `zht`).
 * English fills any key a locale lacks, so a partial catalog stays correct.
 */
export const catalog: Catalog = {
	en: {
		openDashboard: "Open the witness dashboard",
		commandTitle: "Witness: open dashboard",
		commandDescription:
			"Show detailed token and cost stats for this repository",
		openFailed: "Could not open the dashboard: {{error}}",
	},
	zh: {
		openDashboard: "打开 Witness 仪表板",
		commandTitle: "Witness：打开仪表板",
		commandDescription: "显示此仓库的详细令牌和费用统计",
		openFailed: "无法打开仪表板：{{error}}",
	},
	zht: {
		openDashboard: "開啟 Witness 儀表板",
		commandTitle: "Witness：開啟儀表板",
		commandDescription: "顯示此儲存庫的詳細權杖與費用統計",
		openFailed: "無法開啟儀表板：{{error}}",
	},
	ko: {
		openDashboard: "Witness 대시보드 열기",
		commandTitle: "Witness: 대시보드 열기",
		commandDescription: "이 저장소의 자세한 토큰 및 비용 통계 표시",
		openFailed: "대시보드를 열 수 없습니다: {{error}}",
	},
	de: {
		openDashboard: "Witness-Dashboard öffnen",
		commandTitle: "Witness: Dashboard öffnen",
		commandDescription:
			"Detaillierte Token- und Kostenstatistik für dieses Repository anzeigen",
		openFailed: "Dashboard konnte nicht geöffnet werden: {{error}}",
	},
	es: {
		openDashboard: "Abrir el panel de Witness",
		commandTitle: "Witness: abrir panel",
		commandDescription:
			"Mostrar estadísticas detalladas de tokens y costes de este repositorio",
		openFailed: "No se pudo abrir el panel: {{error}}",
	},
	fr: {
		openDashboard: "Ouvrir le tableau de bord Witness",
		commandTitle: "Witness : ouvrir le tableau de bord",
		commandDescription:
			"Afficher les statistiques détaillées de jetons et de coûts de ce dépôt",
		openFailed: "Impossible d’ouvrir le tableau de bord : {{error}}",
	},
	da: {
		openDashboard: "Åbn Witness-dashboardet",
		commandTitle: "Witness: åbn dashboard",
		commandDescription:
			"Vis detaljeret statistik over tokens og omkostninger for dette repository",
		openFailed: "Dashboardet kunne ikke åbnes: {{error}}",
	},
	ja: {
		openDashboard: "Witness ダッシュボードを開く",
		commandTitle: "Witness: ダッシュボードを開く",
		commandDescription: "このリポジトリの詳細なトークンとコストの統計を表示",
		openFailed: "ダッシュボードを開けませんでした: {{error}}",
	},
	pl: {
		openDashboard: "Otwórz panel Witness",
		commandTitle: "Witness: otwórz panel",
		commandDescription:
			"Pokaż szczegółowe statystyki tokenów i kosztów tego repozytorium",
		openFailed: "Nie udało się otworzyć panelu: {{error}}",
	},
	ru: {
		openDashboard: "Открыть панель Witness",
		commandTitle: "Witness: открыть панель",
		commandDescription:
			"Показать подробную статистику токенов и затрат для этого репозитория",
		openFailed: "Не удалось открыть панель: {{error}}",
	},
	uk: {
		openDashboard: "Відкрити панель Witness",
		commandTitle: "Witness: відкрити панель",
		commandDescription:
			"Показати докладну статистику токенів і витрат для цього репозиторію",
		openFailed: "Не вдалося відкрити панель: {{error}}",
	},
	bs: {
		openDashboard: "Otvori Witness nadzornu ploču",
		commandTitle: "Witness: otvori nadzornu ploču",
		commandDescription:
			"Prikaži detaljnu statistiku tokena i troškova za ovaj repozitorij",
		openFailed: "Nadzornu ploču nije moguće otvoriti: {{error}}",
	},
	ar: {
		openDashboard: "فتح لوحة Witness",
		commandTitle: "Witness: فتح لوحة المعلومات",
		commandDescription: "عرض إحصاءات تفصيلية للرموز والتكاليف لهذا المستودع",
		openFailed: "تعذّر فتح لوحة المعلومات: {{error}}",
	},
	he: {
		openDashboard: "פתיחת לוח הבקרה של Witness",
		commandTitle: "Witness: פתיחת לוח הבקרה",
		commandDescription:
			"הצגת סטטיסטיקות מפורטות של אסימונים ועלויות עבור מאגר זה",
		openFailed: "לא ניתן לפתוח את לוח הבקרה: {{error}}",
	},
	no: {
		openDashboard: "Åpne Witness-dashbordet",
		commandTitle: "Witness: åpne dashbord",
		commandDescription:
			"Vis detaljert statistikk over tokens og kostnader for dette repositoriet",
		openFailed: "Kunne ikke åpne dashbordet: {{error}}",
	},
	br: {
		openDashboard: "Abrir o painel do Witness",
		commandTitle: "Witness: abrir painel",
		commandDescription:
			"Mostrar estatísticas detalhadas de tokens e custos deste repositório",
		openFailed: "Não foi possível abrir o painel: {{error}}",
	},
	th: {
		openDashboard: "เปิดแดชบอร์ด Witness",
		commandTitle: "Witness: เปิดแดชบอร์ด",
		commandDescription: "แสดงสถิติโดยละเอียดของโทเค็นและค่าใช้จ่ายสำหรับที่เก็บนี้",
		openFailed: "ไม่สามารถเปิดแดชบอร์ดได้: {{error}}",
	},
	tr: {
		openDashboard: "Witness panosunu aç",
		commandTitle: "Witness: panoyu aç",
		commandDescription:
			"Bu depo için ayrıntılı token ve maliyet istatistiklerini göster",
		openFailed: "Pano açılamadı: {{error}}",
	},
	hi: {
		openDashboard: "Witness डैशबोर्ड खोलें",
		commandTitle: "Witness: डैशबोर्ड खोलें",
		commandDescription: "इस रिपॉज़िटरी के विस्तृत टोकन और लागत आँकड़े दिखाएँ",
		openFailed: "डैशबोर्ड खोल नहीं सका: {{error}}",
	},
	nl: {
		openDashboard: "Witness-dashboard openen",
		commandTitle: "Witness: dashboard openen",
		commandDescription:
			"Gedetailleerde token- en kostenstatistieken voor deze repository tonen",
		openFailed: "Kan het dashboard niet openen: {{error}}",
	},
	id: {
		openDashboard: "Buka dasbor Witness",
		commandTitle: "Witness: buka dasbor",
		commandDescription:
			"Tampilkan statistik token dan biaya terperinci untuk repositori ini",
		openFailed: "Tidak dapat membuka dasbor: {{error}}",
	},
	vi: {
		openDashboard: "Mở bảng điều khiển Witness",
		commandTitle: "Witness: mở bảng điều khiển",
		commandDescription:
			"Hiển thị số liệu thống kê chi tiết về token và chi phí của kho lưu trữ này",
		openFailed: "Không thể mở bảng điều khiển: {{error}}",
	},
	it: {
		openDashboard: "Apri la dashboard di Witness",
		commandTitle: "Witness: apri dashboard",
		commandDescription:
			"Mostra statistiche dettagliate su token e costi per questo repository",
		openFailed: "Impossibile aprire la dashboard: {{error}}",
	},
	ur: {
		openDashboard: "Witness ڈیش بورڈ کھولیں",
		commandTitle: "Witness: ڈیش بورڈ کھولیں",
		commandDescription:
			"اس ریپوزٹری کے تفصیلی ٹوکن اور لاگت کے اعداد و شمار دکھائیں",
		openFailed: "ڈیش بورڈ کھولا نہیں جا سکا: {{error}}",
	},
	pa: {
		openDashboard: "Witness ڈیش بورڈ کھولو",
		commandTitle: "Witness: ڈیش بورڈ کھولو",
		commandDescription:
			"ایس ریپوزٹری دے تفصیلی ٹوکن تے لاگت دے اعداد و شمار وکھاؤ",
		openFailed: "ڈیش بورڈ کھول نئیں سکیا: {{error}}",
	},
	az: {
		openDashboard: "Witness idarə panelini aç",
		commandTitle: "Witness: idarə panelini aç",
		commandDescription:
			"Bu repozitoriya üçün ətraflı token və xərc statistikasını göstər",
		openFailed: "İdarə panelini açmaq mümkün olmadı: {{error}}",
	},
	fi: {
		openDashboard: "Avaa Witness-koontinäkymä",
		commandTitle: "Witness: avaa koontinäkymä",
		commandDescription:
			"Näytä tämän tietovaraston yksityiskohtaiset token- ja kustannustilastot",
		openFailed: "Koontinäkymää ei voitu avata: {{error}}",
	},
	sv: {
		openDashboard: "Öppna Witness-instrumentpanelen",
		commandTitle: "Witness: öppna instrumentpanelen",
		commandDescription:
			"Visa detaljerad statistik över tokens och kostnader för detta repo",
		openFailed: "Det gick inte att öppna instrumentpanelen: {{error}}",
	},
	am: {
		openDashboard: "የWitness ዳሽቦርድ ክፈት",
		commandTitle: "Witness: ዳሽቦርድ ክፈት",
		commandDescription: "የዚህ ማከማቻ ዝርዝር የቶከን እና የወጪ ስታቲስቲክስ አሳይ",
		openFailed: "ዳሽቦርዱን መክፈት አልተቻለም: {{error}}",
	},
	bg: {
		openDashboard: "Отвори таблото на Witness",
		commandTitle: "Witness: отвори табло",
		commandDescription:
			"Покажи подробна статистика за токени и разходи за това хранилище",
		openFailed: "Таблото не може да бъде отворено: {{error}}",
	},
	bn: {
		openDashboard: "Witness ড্যাশবোর্ড খুলুন",
		commandTitle: "Witness: ড্যাশবোর্ড খুলুন",
		commandDescription: "এই রিপোজিটরির বিস্তারিত টোকেন ও খরচের পরিসংখ্যান দেখান",
		openFailed: "ড্যাশবোর্ড খোলা যায়নি: {{error}}",
	},
	ca: {
		openDashboard: "Obre el tauler del Witness",
		commandTitle: "Witness: obre el tauler",
		commandDescription:
			"Mostra estadístiques detallades de tokens i costos d'aquest repositori",
		openFailed: "No s'ha pogut obrir el tauler: {{error}}",
	},
	cs: {
		openDashboard: "Otevřít panel Witness",
		commandTitle: "Witness: otevřít panel",
		commandDescription:
			"Zobrazit podrobné statistiky tokenů a nákladů pro toto úložiště",
		openFailed: "Panel se nepodařilo otevřít: {{error}}",
	},
	dv: {
		openDashboard: "Witness ޑޭޝްބޯޑް ހުޅުވާ",
		commandTitle: "Witness: ޑޭޝްބޯޑް ހުޅުވާ",
		commandDescription: "މި ރެޕޮޒިޓަރީގެ ޓޯކަން އަދި ޚަރަދުގެ ތަފްސީލް ތަފާސްހިސާބު ދައްކާ",
		openFailed: "ޑޭޝްބޯޑް ހުޅުވޭކަށް ނުވި: {{error}}",
	},
	dz: {
		openDashboard: "Witness གི་ཌེཤ་བོརཌ་ཕྱེ་ཕྱེཝ",
		commandTitle: "Witness: ཌེཤ་བོརཌ་ཕྱེ་ཕྱེཝ",
		commandDescription: "མཛོད་ཁང་འདི་གི་ཊོ་ཀེན་དང་ཟད་འགྲོའི་སྡོམ་ཚིག་ཞིབ་ཕྲ་སྟོན",
		openFailed: "ཌེཤ་བོརཌ་ཕྱེ་མ་ཚུགས: {{error}}",
	},
	el: {
		openDashboard: "Άνοιγμα του πίνακα ελέγχου του Witness",
		commandTitle: "Witness: άνοιγμα πίνακα ελέγχου",
		commandDescription:
			"Εμφάνιση λεπτομερών στατιστικών token και κόστους για αυτό το αποθετήριο",
		openFailed: "Δεν ήταν δυνατό το άνοιγμα του πίνακα ελέγχου: {{error}}",
	},
	et: {
		openDashboard: "Ava Witnessi juhtpaneel",
		commandTitle: "Witness: ava juhtpaneel",
		commandDescription:
			"Näita selle hoidla üksikasjalikku tokeni- ja kulustatistikat",
		openFailed: "Juhtpaneeli ei saanud avada: {{error}}",
	},
	fa: {
		openDashboard: "باز کردن داشبورد Witness",
		commandTitle: "Witness: باز کردن داشبورد",
		commandDescription: "نمایش آمار دقیق توکن و هزینه برای این مخزن",
		openFailed: "داشبورد باز نشد: {{error}}",
	},
	fo: {
		openDashboard: "Opna Witness-stýriborðið",
		commandTitle: "Witness: opna stýriborð",
		commandDescription:
			"Vís gjølligari hagtøl fyri token og kostnað fyri hesa goymsluna",
		openFailed: "Stýriborðið kundi ikki opnast: {{error}}",
	},
	hr: {
		openDashboard: "Otvori Witness nadzornu ploču",
		commandTitle: "Witness: otvori nadzornu ploču",
		commandDescription:
			"Prikaži detaljnu statistiku tokena i troškova za ovaj repozitorij",
		openFailed: "Nadzornu ploču nije moguće otvoriti: {{error}}",
	},
	hu: {
		openDashboard: "Witness irányítópult megnyitása",
		commandTitle: "Witness: irányítópult megnyitása",
		commandDescription:
			"Részletes token- és költségstatisztika megjelenítése ehhez a repóhoz",
		openFailed: "Nem sikerült megnyitni az irányítópultot: {{error}}",
	},
	hy: {
		openDashboard: "Բացել Witness-ի վահանակը",
		commandTitle: "Witness: բացել վահանակը",
		commandDescription:
			"Ցուցադրել այս պահոցի թոքենների և ծախսերի մանրամասն վիճակագրությունը",
		openFailed: "Չհաջողվեց բացել վահանակը՝ {{error}}",
	},
	is: {
		openDashboard: "Opna Witness-mælaborðið",
		commandTitle: "Witness: opna mælaborð",
		commandDescription:
			"Sýna ítarlegar tölfræði um tákn og kostnað fyrir þetta geymslu",
		openFailed: "Ekki tókst að opna mælaborðið: {{error}}",
	},
	ka: {
		openDashboard: "Witness-ის დაფის გახსნა",
		commandTitle: "Witness: დაფის გახსნა",
		commandDescription:
			"ამ რეპოზიტორიის ტოკენებისა და ხარჯების დეტალური სტატისტიკის ჩვენება",
		openFailed: "დაფის გახსნა ვერ მოხერხდა: {{error}}",
	},
	km: {
		openDashboard: "បើកផ្ទាំងគ្រប់គ្រង Witness",
		commandTitle: "Witness: បើកផ្ទាំងគ្រប់គ្រង",
		commandDescription: "បង្ហាញស្ថិតិលម្អិតអំពីតូខេន និងថ្លៃដើមសម្រាប់ឃ្លាំងនេះ",
		openFailed: "មិនអាចបើកផ្ទាំងគ្រប់គ្រងបានទេ: {{error}}",
	},
	lo: {
		openDashboard: "ເປີດແດຊບອດ Witness",
		commandTitle: "Witness: ເປີດແດຊບອດ",
		commandDescription: "ສະແດງສະຖິຕິໂທເຄັນ ແລະ ຄ່າໃຊ້ຈ່າຍແບບລະອຽດຂອງບ່ອນເກັບນີ້",
		openFailed: "ບໍ່ສາມາດເປີດແດຊບອດໄດ້: {{error}}",
	},
	lt: {
		openDashboard: "Atidaryti „Witness“ valdymo skydelį",
		commandTitle: "Witness: atidaryti valdymo skydelį",
		commandDescription:
			"Rodyti išsamią šios saugyklos žetonų ir išlaidų statistiką",
		openFailed: "Nepavyko atidaryti valdymo skydelio: {{error}}",
	},
	lv: {
		openDashboard: "Atvērt Witness informācijas paneli",
		commandTitle: "Witness: atvērt informācijas paneli",
		commandDescription:
			"Rādīt detalizētu šīs krātuves marķieru un izmaksu statistiku",
		openFailed: "Nevarēja atvērt informācijas paneli: {{error}}",
	},
	mk: {
		openDashboard: "Отвори ја таблата на Witness",
		commandTitle: "Witness: отвори табла",
		commandDescription:
			"Прикажи детална статистика за токени и трошоци за ова складиште",
		openFailed: "Таблата не може да се отвори: {{error}}",
	},
	mn: {
		openDashboard: "Witness-ийн хянах самбарыг нээх",
		commandTitle: "Witness: хянах самбар нээх",
		commandDescription:
			"Энэ репозиторийн токен болон зардлын дэлгэрэнгүй статистикийг харуулах",
		openFailed: "Хянах самбарыг нээж чадсангүй: {{error}}",
	},
	ms: {
		openDashboard: "Buka papan pemuka Witness",
		commandTitle: "Witness: buka papan pemuka",
		commandDescription:
			"Tunjukkan statistik token dan kos terperinci untuk repositori ini",
		openFailed: "Tidak dapat membuka papan pemuka: {{error}}",
	},
	my: {
		openDashboard: "Witness ဒက်ရှ်ဘုတ်ကို ဖွင့်ပါ",
		commandTitle: "Witness: ဒက်ရှ်ဘုတ် ဖွင့်ပါ",
		commandDescription: "ဤသိုလှောင်ရုံအတွက် တိုကင်နှင့် ကုန်ကျစရိတ် အသေးစိတ် စာရင်းအင်းများကို ပြပါ",
		openFailed: "ဒက်ရှ်ဘုတ်ကို ဖွင့်၍မရပါ: {{error}}",
	},
	ne: {
		openDashboard: "Witness ड्यासबोर्ड खोल्नुहोस्",
		commandTitle: "Witness: ड्यासबोर्ड खोल्नुहोस्",
		commandDescription: "यो रिपोजिटरीको विस्तृत टोकन र लागत तथ्याङ्क देखाउनुहोस्",
		openFailed: "ड्यासबोर्ड खोल्न सकिएन: {{error}}",
	},
	ro: {
		openDashboard: "Deschide panoul Witness",
		commandTitle: "Witness: deschide panoul",
		commandDescription:
			"Afișează statistici detaliate despre tokenuri și costuri pentru acest depozit",
		openFailed: "Panoul nu a putut fi deschis: {{error}}",
	},
	si: {
		openDashboard: "Witness උපකරණ පුවරුව විවෘත කරන්න",
		commandTitle: "Witness: උපකරණ පුවරුව විවෘත කරන්න",
		commandDescription: "මෙම ගබඩාව සඳහා ටෝකන් සහ පිරිවැය පිළිබඳ සවිස්තර සංඛ්‍යාලේඛන පෙන්වන්න",
		openFailed: "උපකරණ පුවරුව විවෘත කළ නොහැකි විය: {{error}}",
	},
	sk: {
		openDashboard: "Otvoriť panel Witness",
		commandTitle: "Witness: otvoriť panel",
		commandDescription:
			"Zobraziť podrobné štatistiky tokenov a nákladov pre toto úložisko",
		openFailed: "Panel sa nepodarilo otvoriť: {{error}}",
	},
	sl: {
		openDashboard: "Odpri nadzorno ploščo Witness",
		commandTitle: "Witness: odpri nadzorno ploščo",
		commandDescription:
			"Prikaži podrobno statistiko žetonov in stroškov za to shrambo",
		openFailed: "Nadzorne plošče ni bilo mogoče odpreti: {{error}}",
	},
	sq: {
		openDashboard: "Hap panelin e Witness",
		commandTitle: "Witness: hap panelin",
		commandDescription:
			"Shfaq statistika të detajuara të tokenëve dhe kostove për këtë depo",
		openFailed: "Paneli nuk mund të hapej: {{error}}",
	},
	sr: {
		openDashboard: "Отвори Witness таблу",
		commandTitle: "Witness: отвори таблу",
		commandDescription:
			"Прикажи детаљну статистику токена и трошкова за ово складиште",
		openFailed: "Табла није могла да се отвори: {{error}}",
	},
	tg: {
		openDashboard: "Кушодани лавҳаи Witness",
		commandTitle: "Witness: кушодани лавҳа",
		commandDescription:
			"Нишон додани омори муфассали токенҳо ва хароҷот барои ин анбор",
		openFailed: "Лавҳаро кушодан муяссар нашуд: {{error}}",
	},
	tk: {
		openDashboard: "Witness panelini aç",
		commandTitle: "Witness: paneli aç",
		commandDescription:
			"Bu saklawy üçin jikme-jik token we çykdajy statistikasyny görkez",
		openFailed: "Paneli açyp bolmady: {{error}}",
	},
	uz: {
		openDashboard: "Witness panelini ochish",
		commandTitle: "Witness: panelni ochish",
		commandDescription:
			"Ushbu repozitoriy uchun token va xarajat statistikasini batafsil ko‘rsatish",
		openFailed: "Panelni ochib bo‘lmadi: {{error}}",
	},
};
