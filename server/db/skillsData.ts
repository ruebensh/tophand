/**
 * TopHand — ish e'lonlari uchun standartlashtirilgan ko'nikmalar (skills) lug'ati.
 *
 * Maqsad: e'lon yaratishda "Required Skills" autosuggest maydoniga bir xil,
 * izchil (standart) teglar bazasini berish — foydalanuvchi "Post..." deb yozsa
 * "Postman", "PostgreSQL" kabi tayyor variantlar chiqadi. Topilmagan holda
 * custom qiymat qo'shish ham mumkin (frontend tomonda).
 *
 * Seed qoidasi: ON CONFLICT(norm) DO NOTHING — admin qo'shgan/tahrirlagan
 * yozuvlar buzilmaydi (`category_attributes` seed qoidasi bilan bir xil).
 * `norm` — qidiruv uchun normallashtirilgan kalit (kichik harf, bitta bo'shliq).
 */

export interface SkillSeed {
  name: string;
  category_hint?: string;
}

// `norm` ni hisoblash: kichik harf, chekkani olish, ko'p bo'shliqni bittaga,
// nuqta/vergul kabi qo'shimcha belgilarni olib tashlash.
export function normalizeSkill(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?"'`]+/g, "")
    .trim();
}

const s = (name: string, category_hint?: string): SkillSeed => ({ name, category_hint });

// Baza — standartlashtirilgan teglar ro'yxati (turkumlanmagan, lekin category_hint
// orqali kelajakda filtrlash mumkin). Double-quote: okina (') belgisi muammosiz.
export const JOB_SKILLS: SkillSeed[] = [
  // IT & Internet
  s("JavaScript", "it"), s("TypeScript", "it"), s("React", "it"), s("Next.js", "it"),
  s("Vue.js", "it"), s("Angular", "it"), s("Node.js", "it"), s("Python", "it"),
  s("Django", "it"), s("Flask", "it"), s("Java", "it"), s("Spring", "it"),
  s("Kotlin", "it"), s("PHP", "it"), s("Laravel", "it"), s("C#", "it"),
  s(".NET", "it"), s("C++", "it"), s("C", "it"), s("Go", "it"), s("Rust", "it"),
  s("Ruby on Rails", "it"), s("Swift", "it"), s("HTML", "it"), s("CSS", "it"),
  s("Tailwind CSS", "it"), s("SASS", "it"), s("Bootstrap", "it"),
  s("PostgreSQL", "it"), s("MySQL", "it"), s("MongoDB", "it"), s("Redis", "it"),
  s("SQLite", "it"), s("Microsoft SQL Server", "it"), s("Oracle DB", "it"),
  s("REST API", "it"), s("GraphQL", "it"), s("WebSocket", "it"), s("Microservices", "it"),
  s("Git", "it"), s("GitHub", "it"), s("GitLab", "it"), s("Docker", "it"),
  s("Kubernetes", "it"), s("Nginx", "it"), s("Linux", "it"), s("Bash", "it"),
  s("CI/CD", "it"), s("Jenkins", "it"), s("GitHub Actions", "it"), s("AWS", "it"),
  s("Azure", "it"), s("Google Cloud", "it"), s("Cloudflare", "it"), s("Terraform", "it"),
  s("Ansible", "it"), s("Prometheus", "it"), s("Grafana", "it"), s("Elasticsearch", "it"),
  s("Kibana", "it"), s("QA", "it"), s("QA Automation", "it"), s("Selenium", "it"),
  s("Cypress", "it"), s("Playwright", "it"), s("Postman", "it"), s("JMeter", "it"),
  s("Unit Testing", "it"), s("Integration Testing", "it"), s("Manual Testing", "it"),
  s("Load Testing", "it"), s("API Testing", "it"), s("Figma", "it"), s("UI/UX dizayn", "it"),
  s("Adobe XD", "it"), s("Prototiplash", "it"), s("Design system", "it"),
  s("1C:Predpriyatie", "it"), s("1C dasturlash", "it"), s("Bitrix", "it"),
  s("WordPress", "it"), s("OpenCart", "it"), s("Shopify", "it"),
  s("Machine Learning", "it"), s("TensorFlow", "it"), s("PyTorch", "it"),
  s("Pandas", "it"), s("NumPy", "it"), s("SQL tahlil", "it"), s("Data Analysis", "it"),
  s("Power BI", "it"), s("Tableau", "it"), s("ETL", "it"), s("Cybersecurity", "it"),
  s("Pentest", "it"), s("OWASP", "it"), s("Firewall", "it"), s("Jira", "it"),
  s("Trello", "it"), s("Notion", "it"), s("Agile", "it"), s("Scrum", "it"), s("Kanban", "it"),

  // Savdo, menejment, marketing, moliya, HR
  s("Sotuv", "sales"), s("B2B sotuv", "sales"), s("B2C sotuv", "sales"),
  s("Muzokara (negotiation)", "sales"), s("Klident bilan ishlash", "sales"),
  s("CRM (Bitrix24)", "sales"), s("CRM (AmoCRM)", "sales"), s("Cold call", "sales"),
  s("Sotuv voronkasi", "sales"), s("Marketing", "sales"), s("SMM", "sales"),
  s("Target reklama", "sales"), s("SEO", "sales"), s("Copywriting", "sales"),
  s("Google Ads", "sales"), s("Yandex Direct", "sales"), s("Facebook Ads", "sales"),
  s("Instagram reklama", "sales"), s("Web Analytics", "sales"), s("Brend menejmenti", "sales"),
  s("Reklama dizayni", "sales"), s("Marketpleys boshqaruvi", "sales"), s("Kassa apparati", "sales"),
  s("Tovarovedeniye", "sales"), s("Ombor (sklad)", "sales"), s("1C savdo", "sales"),
  s("Jamoa boshqaruvi", "mgmt"), s("Loyihalar boshqaruvi", "mgmt"),
  s("Strategik rejalashtirish", "mgmt"), s("Moliya", "fin"), s("Buxgalteriya", "fin"),
  s("Audit", "fin"), s("Soliq", "fin"), s("Excel", "fin"), s("1C buxgalteriya", "fin"),
  s("HR", "hr"), s("Recruitment", "hr"), s("Kadrlar boshqaruvi", "hr"),
  s("Oqitish (training)", "hr"),

  // Xizmat, hunarmandchilik, tibbiyot, ta'lim, til
  s("Tamirlash (remont)", "service"), s("Santexnika", "service"), s("Elektr ishlari", "service"),
  s("Payvandlash (svarka)", "service"), s("Konditsioner ornatish", "service"),
  s("Gipsokarton", "service"), s("Boyqochilik", "service"), s("Kafel/plitka", "service"),
  s("Mebel yigish", "service"), s("Asboblar bilan ishlash", "service"),
  s("Tozalash (klining)", "service"), s("Uybekar", "service"), s("Oshpazlik", "service"),
  s("Pazandalik (pekar)", "service"), s("Garsonlik", "service"), s("Ofitsiantlik", "service"),
  s("Bartenderlik", "service"), s("Sochtarlik (barbershop)", "service"),
  s("Manikyur", "service"), s("Vizaj", "service"), s("Kosmetologiya", "service"),
  s("Lazer epilyatsiya", "service"), s("Tibbiyot", "med"), s("Shifokor", "med"),
  s("Hamshiralik", "med"), s("Farmatsevtika", "med"), s("Stomatologiya", "med"),
  s("Tarjimachilik", "lang"), s("Ingliz tili", "lang"), s("Rus tili", "lang"),
  s("Nemis tili", "lang"), s("Turk tili", "lang"), s("Arab tili", "lang"),
  s("Qitoy tili", "lang"), s("Oqituvchilik", "edu"), s("Repetitorlik", "edu"),
  s("Boshlangich ta'lim", "edu"), s("Matematika", "edu"), s("Fizika", "edu"),
  s("Informatika", "edu"),

  // Transport, logistika
  s("Haydovchilik (kategoriya B)", "transport"), s("Haydovchilik (kategoriya C)", "transport"),
  s("Haydovchilik (kategoriya D)", "transport"), s("Yuk tashish", "transport"),
  s("Xalqaro reyslar", "transport"), s("Ekspeditor", "transport"), s("Logistika", "transport"),
  s("Skklad boshqaruvi", "transport"), s("Kuryer yetkazib berish", "transport"),
  s("Gruber (pogruzchik)", "transport"), s("Taksi", "transport"), s("Dispatcher", "transport"),
  s("Texnik xizmat (avto)", "transport"), s("Shinomontazh", "transport"),
  s("Avtodiagnostika", "transport"), s("Korpus va boyq ishlari", "transport"),

  // Umumiy ko'nikmalar
  s("Microsoft Office", "general"), s("Word", "general"), s("PowerPoint", "general"),
  s("Google Workspace", "general"), s("Hujjat aylanishi", "general"), s("Arxiv ishlari", "general"),
  s("Telefon orqali muloqot", "general"), s("Javobgarlik", "general"),
  s("Ish tartibi (discipline)", "general"), s("Jamoa bilan ishlash", "general"),
  s("Kop vazifalilik", "general"), s("Bosimga chidamlilik", "general"),
  s("Tadbirkorlik", "general"), s("Tender ishlari", "general"), s("Snabjenie", "general"),
].filter((x) => !!normalizeSkill(x.name));
