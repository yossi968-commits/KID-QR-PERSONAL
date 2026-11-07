import { useState } from 'react';
import { useI18n } from '../i18n';
import { giftUrl } from './Qr';

/**
 * Ready-made birthday announcements the parent copies or shares to WhatsApp, Instagram or Facebook.
 * Three school levels × boy/girl, filled with the child's first name, birthday age and gift link.
 * Hebrew is gendered; the English set is written without pronouns. Other UI languages use English.
 */
type Level = 'elementary' | 'middle' | 'high';
type Platform = 'whatsapp' | 'instagram' | 'facebook';
type Vars = { name: string; age: number; url: string; boy: boolean };

const LEVELS: Level[] = ['elementary', 'middle', 'high'];
const PLATFORMS: Platform[] = ['whatsapp', 'instagram', 'facebook'];

const HE: Record<Level, Record<Platform, (v: Vars) => string>> = {
  elementary: {
    whatsapp: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `🎂 ${name} ${g('בן', 'בת')} ${age} השבוע!

השנה, במקום עוד צעצוע, אפשר לתת ${g('לו', 'לה')} מתנה לעתיד: כל שקל דרך QR-Livela מושקע בחשבון על ${g('שמו', 'שמה')} עד גיל 21 🌱
${g('הוא', 'היא')} אפילו רואה באפליקציה איך העץ ${g('שלו', 'שלה')} גדל 🌳

לוקח דקה, גם בביט 👇
${url}

ואם תשאירו ברכה, נקרא ${g('לו', 'לה')} אותה במסיבה 🥳`;
    },
    instagram: ({ name, age, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${name} ${g('בן', 'בת')} ${age} ✨
${g('הוא ביקש', 'היא ביקשה')} עוגה עם סוכריות. אנחנו ביקשנו עוד דבר אחד: שכל מי ${g('שאוהב אותו', 'שאוהב אותה')} יהיה חלק מהעתיד ${g('שלו', 'שלה')}.
סריקה אחת, מתנה שגדלה ${g('איתו', 'איתה')} עד גיל 21 🌳
הקישור למתנה בביו 👆

#QRLivela #יוםהולדתשמח #מתנהלעתיד #חיסכוןלכלילד`;
    },
    facebook: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${name} שלנו ${g('בן', 'בת')} ${age} היום! 🎉

${g('הוא כבר קורא לבד, רוכב על אופניים', 'היא כבר קוראת לבד, רוכבת על אופניים')} בלי גלגלי עזר, ${g('ומסביר', 'ומסבירה')} לנו מה זה ריבית דריבית 😄

בשנים האחרונות המתנות ${g('שלו', 'שלה')} ממשפחה וחברים לא נעלמות במגירה. הן מושקעות על ${g('שמו', 'שמה')} דרך QR-Livela, ${g('והוא רואה', 'והיא רואה')} באפליקציה את העץ ${g('שלו', 'שלה')} גדל ${g('ולומד', 'ולומדת')} שם במשחק מה זה חיסכון 🌳

מי שרוצה להצטרף לחגיגה, זה לוקח דקה (ביט, כרטיס אשראי או Apple Pay):
${url}

וברכות כאן בתגובות מתקבלות באהבה ❤️`;
    },
  },
  middle: {
    whatsapp: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `🎉 ${name} ${g('בן', 'בת')} ${age}!

${g('הוא גדל', 'היא גדלה')} כל כך מהר, וגם החיסכון ${g('שלו', 'שלה')}. מי שרוצה לפרגן, מתנה דרך QR-Livela נכנסת לחשבון השקעה על ${g('שמו', 'שמה')} ומחכה ${g('לו', 'לה')} עד גיל 21 🌱

סורקים או לוחצים, בוחרים סכום, ואפשר לצרף ברכה (גם כזאת שתיפתח רק בגיל 18 💌):
${url}

תודה שאתם חלק מהדרך ${g('שלו', 'שלה')} 💛`;
    },
    instagram: ({ name, age, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${age} 🎂 ${name}
${g('הוא כבר יודע', 'היא כבר יודעת')} מה ${g('הוא רוצה', 'היא רוצה')} להיות. אנחנו רק דואגים שיהיה ${g('לו', 'לה')} עם מה להתחיל.
כל מתנה דרך הקוד ${g('שלו', 'שלה')} מושקעת על ${g('שמו', 'שמה')} עד גיל 21 📈
הקישור בביו, ואפשר גם לסרוק את הקוד בתמונה השנייה 👆

#QRLivela #יוםהולדת #מתנהלעתיד #חטיבה`;
    },
    facebook: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${name} ${g('בן', 'בת')} ${age} 🎂

זה הגיל שבו פתאום יש דעות, חברים, תוכניות ומסכים 😅 וזה גם הגיל שבו ${g('הוא התחיל', 'היא התחילה')} להבין מה זה כסף ולמה כדאי לתת לו זמן לגדול.

מאז שנולד${g('', 'ה')}, המתנות ${g('שלו', 'שלה')} מושקעות בחשבון על ${g('שמו', 'שמה')} דרך QR-Livela, בבית השקעות מפוקח, עד גיל 21. היום ${g('הוא עוקב', 'היא עוקבת')} אחרי החיסכון באפליקציה ${g('ולומד', 'ולומדת')} בעצמ${g('ו', 'ה')} איך זה עובד.

מי שרוצה לפרגן, לתת מתנה ולהשאיר ברכה:
${url}

מזל טוב ${g('לבן', 'לבת')} שלנו ❤️`;
    },
  },
  high: {
    whatsapp: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${name} ${g('בן', 'בת')} ${age} 🎉

עוד רגע צבא, רישיון, לימודים ודירה ראשונה. מי שרוצה לפרגן, מתנה דרך QR-Livela נכנסת לחיסכון ${g('שלו', 'שלה')} ומושקעת על ${g('שמו', 'שמה')} עד גיל 21:
${url}

ובגיל 18 ${g('הוא מקבל', 'היא מקבלת')} את הניהול לידיים ${g('שלו', 'שלה')} 💪`;
    },
    instagram: ({ name, age, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${name} · ${age} 🎂
${g('הוא כבר מתכנן', 'היא כבר מתכננת')} את הצעד הבא. אנחנו בונים ${g('לו', 'לה')} את הבסיס.
מתנה דרך QR-Livela מושקעת על ${g('שמו', 'שמה')} עד גיל 21, ובגיל 18 ${g('הוא מנהל', 'היא מנהלת')} אותה ${g('בעצמו', 'בעצמה')} 🚀
הקישור בביו 👆

#QRLivela #יוםהולדת #תיכון #מתנהלעתיד`;
    },
    facebook: ({ name, age, url, boy }) => {
      const g = (m: string, f: string) => (boy ? m : f);
      return `${g('הבן', 'הבת')} שלנו ${name} ${g('בן', 'בת')} ${age} 🌟

מה שהתחיל כקוד קטן ביום ההולדת הראשון ${g('שלו', 'שלה')} הפך לחיסכון אמיתי ${g('שלו', 'שלה')}. כל השנים משפחה וחברים נתנו מתנות דרך QR-Livela, והכסף הושקע על ${g('שמו', 'שמה')} בבית השקעות מפוקח.

היום ${g('הוא עוקב', 'היא עוקבת')} אחריו ${g('בעצמו', 'בעצמה')}, ובגיל 18 הניהול עובר ${g('אליו', 'אליה')}. בגיל 21 ${g('הוא יצא', 'היא תצא')} לדרך עם בסיס ${g('שבנה', 'שבנתה')} יחד עם כל מי ${g('שאוהב אותו', 'שאוהב אותה')}.

כל מי שרוצה להוסיף לעתיד ${g('שלו', 'שלה')} מוזמן:
${url}

מזל טוב לנו ${g('ולו', 'ולה')} 🎂`;
    },
  },
};

const EN: Record<Level, Record<Platform, (v: Vars) => string>> = {
  elementary: {
    whatsapp: ({ name, age, url }) => `🎂 ${name} turns ${age} this week!

This year, instead of another toy, you can give a gift for the future: every shekel through QR-Livela is invested in an account in ${name}'s name until age 21 🌱

Takes a minute 👇
${url}

Leave a greeting too and we'll read it out at the party 🥳`,
    instagram: ({ name, age }) => `${name} is ${age} ✨
Cake with sprinkles, please. And one more wish from us: that everyone who loves ${name} becomes part of their future.
One scan, a gift that grows until 21 🌳
Gift link in bio 👆

#QRLivela #HappyBirthday #GiftForTheFuture`,
    facebook: ({ name, age, url }) => `Our ${name} is ${age} today! 🎉

Reading alone, riding without training wheels, and explaining compound interest to us 😄

For a few years now, gifts from family and friends don't vanish in a drawer. They're invested in ${name}'s name through QR-Livela, and ${name} watches the money tree grow in the app 🌳

Want to join the celebration? It takes a minute:
${url}

Greetings in the comments are very welcome ❤️`,
  },
  middle: {
    whatsapp: ({ name, age, url }) => `🎉 ${name} is ${age}!

Growing so fast, and so are the savings. A gift through QR-Livela goes into an investment account in ${name}'s name and waits there until age 21 🌱

Scan or tap, pick an amount, add a greeting (even one that only opens at 18 💌):
${url}

Thank you for being part of the journey 💛`,
    instagram: ({ name, age }) => `${age} 🎂 ${name}
Already knows what they want to be. We just make sure there's something to start with.
Every gift through the code is invested until 21 📈
Link in bio, or scan the code in the second photo 👆

#QRLivela #Birthday #GiftForTheFuture`,
    facebook: ({ name, age, url }) => `${name} is ${age} 🎂

The age of opinions, friends, plans and screens 😅 and also the age of starting to understand money and why it's worth giving it time to grow.

Since birth, gifts have been invested in ${name}'s name through QR-Livela, at a regulated investment house, until age 21. Now ${name} follows the savings in the app and learns how it works.

Want to give a gift and leave a greeting?
${url}

Happy birthday to our ${name} ❤️`,
  },
  high: {
    whatsapp: ({ name, age, url }) => `${name} is ${age} 🎉

Army, licence, studies and a first apartment are just around the corner. A gift through QR-Livela goes into ${name}'s savings, invested until age 21:
${url}

And at 18, ${name} takes over managing it 💪`,
    instagram: ({ name, age }) => `${name} · ${age} 🎂
Planning the next step. We're building the base.
Gifts through QR-Livela are invested until 21, and from 18 ${name} manages them 🚀
Link in bio 👆

#QRLivela #Birthday #GiftForTheFuture`,
    facebook: ({ name, age, url }) => `Our ${name} is ${age} 🌟

What started as a small code on the first birthday became real savings. For years family and friends gave gifts through QR-Livela, invested in ${name}'s name at a regulated investment house.

Today ${name} follows it in the app, takes over at 18, and at 21 sets off with a base built together with everyone who loves them.

Want to add to that future?
${url}

Happy birthday to ${name}, and to us 🎂`,
  },
};

const LABELS = {
  he: {
    title: 'פרסומי יום הולדת מוכנים', desc: 'נוסחים מוכנים עם השם, הגיל והקישור של {name}. בוחרים, עורכים אם רוצים, ומשתפים.',
    elementary: 'יסודי', middle: 'חטיבה', high: 'תיכון', boy: 'בן', girl: 'בת',
    whatsapp: 'וואטסאפ', instagram: 'אינסטגרם', facebook: 'פייסבוק',
    copy: 'העתקת הנוסח', copied: 'הועתק!', sendWa: 'שליחה בוואטסאפ', openFb: 'העתקה ופתיחת פייסבוק', share: 'שיתוף…',
    igHint: 'באינסטגרם אי אפשר ללחוץ על קישור בפוסט: הדביקו את הקישור בביו או במדבקת קישור בסטורי, וצרפו את כרטיס ה־QR כתמונה.',
    fbHint: 'פייסבוק לא ממלא טקסט מראש, לכן הנוסח מועתק ותדביקו אותו בפוסט.',
    note: 'אל תבטיחו תשואה או סכום עתידי בפרסום. אפשר לכתוב "מושקע לטווח ארוך".',
  },
  en: {
    title: 'Ready-made birthday posts', desc: 'Posts filled with {name}\'s name, age and link. Pick one, edit if you like, and share.',
    elementary: 'Elementary', middle: 'Middle school', high: 'High school', boy: 'Boy', girl: 'Girl',
    whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
    copy: 'Copy text', copied: 'Copied!', sendWa: 'Send on WhatsApp', openFb: 'Copy and open Facebook', share: 'Share…',
    igHint: 'Links in Instagram posts aren\'t clickable: put the link in your bio or a story link sticker, and add the QR card as a photo.',
    fbHint: 'Facebook doesn\'t prefill text, so the post is copied for you to paste.',
    note: 'Don\'t promise a return or a future amount. "Invested for the long term" is fine.',
  },
};

/** The age the child turns on the coming birthday. */
const turningAge = (birthDate: string, nextBirthday: string) => Number(nextBirthday.slice(0, 4)) - Number(birthDate.slice(0, 4));
/** Grade 1–6 (and younger) → elementary, 7–9 → middle, 10+ → high. */
export const levelForGrade = (grade: number): Level => (grade <= 6 ? 'elementary' : grade <= 9 ? 'middle' : 'high');

export default function BirthdayPosts({ child }: { child: { firstName: string; giftCode: string; birthDate: string; nextBirthday: string; grade: number } }) {
  const { locale } = useI18n();
  const heb = locale === 'he';
  const L = heb ? LABELS.he : LABELS.en;
  const [level, setLevel] = useState<Level>(levelForGrade(child.grade));
  // Gender isn't stored on the child, so the parent's pick is remembered per child on this device.
  const gKey = `bp-gender-${child.giftCode}`;
  const [boy, setBoyState] = useState(() => { try { return localStorage.getItem(gKey) !== 'f'; } catch { return true; } });
  const setBoy = (b: boolean) => { setBoyState(b); try { localStorage.setItem(gKey, b ? 'm' : 'f'); } catch {} };
  const [platform, setPlatform] = useState<Platform>('whatsapp');
  const url = giftUrl(child.giftCode);
  const make = () => (heb ? HE : EN)[level][platform]({ name: child.firstName, age: turningAge(child.birthDate, child.nextBirthday), url, boy });
  // The text stays editable; it resets when a choice changes.
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? make();
  const [copied, setCopied] = useState(false);
  const pick = (f: () => void) => { f(); setEdited(null); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="card stack" style={{ marginTop: 16 }} data-testid="birthday-posts">
      <div>
        <h2 style={{ margin: 0 }}>🎂 {L.title}</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>{L.desc.replace('{name}', child.firstName)}</p>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="level">
          {LEVELS.map((l) => <button key={l} type="button" className={level === l ? 'on' : ''} aria-pressed={level === l} onClick={() => pick(() => setLevel(l))}>{L[l]}</button>)}
        </div>
        {heb && (
          <div className="seg" role="group" aria-label="gender">
            <button type="button" className={boy ? 'on' : ''} aria-pressed={boy} onClick={() => pick(() => setBoy(true))}>{L.boy}</button>
            <button type="button" className={!boy ? 'on' : ''} aria-pressed={!boy} onClick={() => pick(() => setBoy(false))}>{L.girl}</button>
          </div>
        )}
      </div>
      <div className="tabs" role="tablist">
        {PLATFORMS.map((p) => <button key={p} type="button" role="tab" aria-selected={platform === p} className={platform === p ? 'on' : ''} onClick={() => pick(() => setPlatform(p))}>{L[p]}</button>)}
      </div>
      <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={12} dir={heb ? 'rtl' : 'ltr'} style={{ width: '100%', lineHeight: 1.6, resize: 'vertical' }} aria-label={L.title} />
      {platform === 'instagram' && <p className="small muted" style={{ margin: 0 }}>💡 {L.igHint}</p>}
      {platform === 'facebook' && <p className="small muted" style={{ margin: 0 }}>💡 {L.fbHint}</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary" onClick={copy}>📋 {copied ? L.copied : L.copy}</button>
        {platform === 'whatsapp' && <a className="btn" style={{ background: '#1f8f4e', color: '#fff' }} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">💬 {L.sendWa}</a>}
        {platform === 'facebook' && <a className="btn" style={{ background: '#1877f2', color: '#fff' }} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" onClick={copy}>📘 {L.openFb}</a>}
        {canShare && <button type="button" className="btn ghost" onClick={() => navigator.share({ text }).catch(() => {})}>📤 {L.share}</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{L.note}</p>
    </div>
  );
}
