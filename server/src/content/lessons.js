/**
 * Financial-education curriculum by age band. Each lesson has a short story,
 * a "try it" activity and a quiz; completing a quiz earns stars.
 * Content is bilingual (he / en); add a locale by adding a key.
 */
export const AGE_BANDS = [
  { id: 'little', from: 4, to: 7 },
  { id: 'kids', from: 8, to: 12 },
  { id: 'teens', from: 13, to: 17 },
  { id: 'young', from: 18, to: 21 },
];

export const LESSONS = [
  {
    id: 'what-is-money', band: 'little', icon: '🪙', stars: 3,
    he: {
      title: 'מה זה כסף?',
      body: 'פעם אנשים החליפו דברים: תפוח תמורת ביצה. אבל מה אם לבעל הביצים לא היה בא תפוח? בגלל זה המציאו כסף: משהו שכולם מסכימים שיש לו ערך, ואפשר להחליף אותו בכל דבר.',
      activity: 'ספרו יחד עם ההורים כמה מטבעות יש בארנק, ונסו לסדר אותם מהקטן לגדול.',
      quiz: [
        { q: 'למה המציאו כסף?', options: ['כדי שיהיה קל להחליף דברים', 'כי הוא יפה', 'כדי לשחק בו'], answer: 0 },
        { q: 'מה אפשר לעשות עם כסף?', options: ['רק לאכול אותו', 'לקנות, לחסוך ולתת', 'כלום'], answer: 1 },
      ],
    },
    en: {
      title: 'What is money?',
      body: 'Long ago people swapped things: an apple for an egg. But what if the egg owner did not want an apple? So people invented money: something everyone agrees has value and can be swapped for anything.',
      activity: 'Count the coins in a wallet with your parents and line them up from smallest to biggest.',
      quiz: [
        { q: 'Why was money invented?', options: ['To make swapping easy', 'Because it is pretty', 'To play with'], answer: 0 },
        { q: 'What can you do with money?', options: ['Only eat it', 'Spend, save and give', 'Nothing'], answer: 1 },
      ],
    },
  },
  {
    id: 'three-jars', band: 'little', icon: '🫙', stars: 3,
    he: {
      title: 'שלוש הצנצנות',
      body: 'יש לנו שלוש צנצנות: אחת ל"עכשיו" (לקנות משהו קטן), אחת ל"אחר כך" (לחסוך למשהו גדול), ואחת ל"לתת" (לעזור לאחרים). כל פעם שמקבלים כסף, מחלקים אותו בין הצנצנות.',
      activity: 'הכינו שלוש צנצנות מקופסאות ריקות וציירו על כל אחת סמל.',
      quiz: [
        { q: 'לאיזו צנצנת שמים כסף לאופניים חדשים?', options: ['עכשיו', 'אחר כך', 'לתת'], answer: 1 },
        { q: 'מה עושים עם צנצנת ה"לתת"?', options: ['קונים ממתקים', 'עוזרים לאחרים', 'זורקים'], answer: 1 },
      ],
    },
    en: {
      title: 'The three jars',
      body: 'We have three jars: one for "now" (a small treat), one for "later" (saving for something big) and one for "giving" (helping others). Every time you get money, split it between the jars.',
      activity: 'Make three jars from empty boxes and draw a symbol on each.',
      quiz: [
        { q: 'Which jar is for a new bike?', options: ['Now', 'Later', 'Giving'], answer: 1 },
        { q: 'What is the giving jar for?', options: ['Candy', 'Helping others', 'Throwing away'], answer: 1 },
      ],
    },
  },
  {
    id: 'money-tree', band: 'little', icon: '🌱', stars: 4,
    he: {
      title: 'הכסף שגדל כמו עץ',
      body: 'כשאנחנו שותלים זרע ומחכים בסבלנות, הוא הופך לעץ שנותן פירות. גם הכסף שהמשפחה נותנת לך ביום ההולדת נשתל, וכל שנה הוא גדל קצת יותר. ככל שמחכים יותר, העץ גדל יותר!',
      activity: 'בדקו בלוח הבקרה כמה העץ שלכם גדל מאז יום ההולדת הקודם.',
      quiz: [{ q: 'מה עוזר לעץ הכסף לגדול?', options: ['סבלנות וזמן', 'לצעוק עליו', 'לחפור אותו כל יום'], answer: 0 }],
    },
    en: {
      title: 'Money that grows like a tree',
      body: 'When we plant a seed and wait patiently it becomes a tree that gives fruit. The money your family gives you on your birthday is planted too, and every year it grows a little more. The longer you wait, the bigger the tree!',
      activity: 'Check on the dashboard how much your tree has grown since your last birthday.',
      quiz: [{ q: 'What helps the money tree grow?', options: ['Patience and time', 'Shouting at it', 'Digging it up daily'], answer: 0 }],
    },
  },
  {
    id: 'needs-wants', band: 'kids', icon: '⚖️', stars: 4,
    he: {
      title: 'צריך או רוצה?',
      body: 'צורך הוא משהו שאי אפשר בלעדיו: אוכל, בגדים, בית. רצון הוא משהו שנחמד שיהיה: משחק חדש, נעליים של מותג. אין רע ברצונות, אבל חשוב לדעת להבדיל ולתכנן.',
      activity: 'כתבו רשימה של 10 דברים שקניתם החודש וסמנו ליד כל אחד: צורך או רצון.',
      quiz: [
        { q: 'מה מהבאים הוא צורך?', options: ['קונסולת משחקים', 'ארוחת צהריים', 'מדבקות'], answer: 1 },
        { q: 'מה כדאי לעשות לפני קנייה גדולה של רצון?', options: ['לחכות כמה ימים ולחשוב', 'לקנות מיד', 'לקנות שניים'], answer: 0 },
      ],
    },
    en: {
      title: 'Need or want?',
      body: 'A need is something you cannot live without: food, clothes, a home. A want is nice to have: a new game, brand-name shoes. Wants are fine, but it matters to tell them apart and plan.',
      activity: 'List 10 things bought this month and mark each one: need or want.',
      quiz: [
        { q: 'Which is a need?', options: ['Game console', 'Lunch', 'Stickers'], answer: 1 },
        { q: 'What should you do before a big "want" purchase?', options: ['Wait a few days and think', 'Buy right away', 'Buy two'], answer: 0 },
      ],
    },
  },
  {
    id: 'compound-interest', band: 'kids', icon: '❄️', stars: 5,
    he: {
      title: 'כדור השלג של ריבית דריבית',
      body: 'כשהכסף מרוויח, גם הרווח מתחיל להרוויח. זה כמו כדור שלג שמתגלגל במורד: בהתחלה הוא קטן, אבל ככל שהוא מתגלגל הוא אוסף יותר שלג, ומהר יותר. 1,000 ₪ שגדלים ב־7% בשנה הופכים לכ־2,000 ₪ אחרי 10 שנים, ולכ־4,000 ₪ אחרי 20 שנה.',
      activity: 'בעזרת המחשבון בלוח הבקרה, בדקו מה קורה לחיסכון שלכם אם מחכים עוד 5 שנים.',
      quiz: [
        { q: 'מה זה ריבית דריבית?', options: ['רווח על רווח', 'עמלה לבנק', 'סוג של מטבע'], answer: 0 },
        { q: 'מה הכי עוזר לכדור השלג לגדול?', options: ['זמן', 'מזל', 'לבדוק אותו כל דקה'], answer: 0 },
      ],
    },
    en: {
      title: 'The compound-interest snowball',
      body: 'When money earns, the earnings start earning too. It is like a snowball rolling downhill: small at first, but it collects more snow, faster. ₪1,000 growing 7% a year becomes about ₪2,000 after 10 years and about ₪4,000 after 20.',
      activity: 'Use the dashboard projection to see what happens if you wait 5 more years.',
      quiz: [
        { q: 'What is compound interest?', options: ['Earning on earnings', 'A bank fee', 'A kind of coin'], answer: 0 },
        { q: 'What helps the snowball most?', options: ['Time', 'Luck', 'Checking it every minute'], answer: 0 },
      ],
    },
  },
  {
    id: 'what-is-a-share', band: 'kids', icon: '🏢', stars: 5,
    he: {
      title: 'מה זה מניה?',
      body: 'מניה היא חתיכה קטנה מחברה. אם קנית מניה של חברת משחקים, אתה בעלים של חלק קטנטן ממנה. כשהחברה מצליחה, החתיכה שלך שווה יותר. מדד הוא סל של הרבה מניות ביחד, כך שלא שמים את כל הביצים בסל אחד.',
      activity: 'בחרו שלוש חברות שאתם משתמשים במוצרים שלהן כל יום. כולן נסחרות בבורסה?',
      quiz: [
        { q: 'מה זו מניה?', options: ['חלק בבעלות על חברה', 'הלוואה לחבר', 'כרטיס הגרלה'], answer: 0 },
        { q: 'למה קונים מדד ולא מניה אחת?', options: ['פיזור הסיכון', 'כי זה יותר יקר', 'אין סיבה'], answer: 0 },
      ],
    },
    en: {
      title: 'What is a share?',
      body: 'A share is a small piece of a company. Buy a share of a toy company and you own a tiny part of it. When the company does well, your piece is worth more. An index is a basket of many shares, so you do not put all your eggs in one basket.',
      activity: 'Pick three companies whose products you use every day. Are they all on the stock exchange?',
      quiz: [
        { q: 'What is a share?', options: ['Part-ownership of a company', 'A loan to a friend', 'A raffle ticket'], answer: 0 },
        { q: 'Why buy an index rather than one share?', options: ['Spreading risk', 'It costs more', 'No reason'], answer: 0 },
      ],
    },
  },
  {
    id: 'risk-return', band: 'teens', icon: '🎢', stars: 6,
    he: {
      title: 'סיכון ותשואה',
      body: 'השקעות עם פוטנציאל לתשואה גבוהה יותר (כמו מניות) עולות ויורדות יותר בדרך. השקעות שקטות יותר (כמו אג"ח) מרוויחות פחות בממוצע. כשיש לך הרבה שנים עד שתצטרך את הכסף, אפשר לסבול ירידות זמניות כדי ליהנות מצמיחה ארוכת טווח.',
      activity: 'השוו בלוח הבקרה בין מסלול סולידי למסלול מנייתי. מה ההבדל הצפוי בגיל 21?',
      quiz: [
        { q: 'מה בדרך כלל נכון לגבי מניות לעומת אג"ח?', options: ['תנודתיות ותשואה צפויה גבוהות יותר', 'אף פעם לא יורדות', 'תמיד מפסידות'], answer: 0 },
        { q: 'למי מתאים יותר מסלול מנייתי?', options: ['למי שצריך את הכסף בעוד חודש', 'למי שיש לו טווח השקעה ארוך', 'לאף אחד'], answer: 1 },
      ],
    },
    en: {
      title: 'Risk and return',
      body: 'Investments with higher potential returns (like stocks) swing up and down more along the way. Calmer ones (like bonds) earn less on average. With many years until you need the money, you can ride out temporary drops to enjoy long-term growth.',
      activity: 'Compare a conservative and an equity track on the dashboard. What is the expected gap at 21?',
      quiz: [
        { q: 'What is usually true of stocks vs. bonds?', options: ['Higher volatility and expected return', 'They never fall', 'They always lose'], answer: 0 },
        { q: 'Who is an equity track better suited to?', options: ['Someone needing the money next month', 'Someone with a long horizon', 'Nobody'], answer: 1 },
      ],
    },
  },
  {
    id: 'fees', band: 'teens', icon: '🧾', stars: 6,
    he: {
      title: 'דמי ניהול: הגנב השקט',
      body: 'דמי ניהול נראים קטנים: 0.5% או 1% בשנה. אבל לאורך 20 שנה, הפרש של 0.5% יכול לאכול עשרה אחוזים מהסכום הסופי. תמיד בדקו כמה אתם משלמים, ואל תתביישו להתמקח.',
      activity: 'חשבו: 100,000 ₪ ל־20 שנה ב־7% מול 6.5%. מה ההפרש?',
      quiz: [{ q: 'למה דמי ניהול חשובים לטווח ארוך?', options: ['כי הם מצטברים כמו ריבית דריבית, רק הפוך', 'הם לא חשובים', 'כי הם משתנים כל יום'], answer: 0 }],
    },
    en: {
      title: 'Fees: the silent thief',
      body: 'Management fees look small: 0.5% or 1% a year. Over 20 years a 0.5% gap can eat ten percent of the final amount. Always check what you pay, and do not be shy to negotiate.',
      activity: 'Work out: ₪100,000 over 20 years at 7% vs. 6.5%. What is the gap?',
      quiz: [{ q: 'Why do fees matter long-term?', options: ['They compound, in reverse', 'They do not', 'They change daily'], answer: 0 }],
    },
  },
  {
    id: 'first-salary', band: 'teens', icon: '💼', stars: 6,
    he: {
      title: 'המשכורת הראשונה',
      body: 'בתלוש השכר יש ברוטו (מה שהמעסיק משלם) ונטו (מה שנכנס לחשבון). ביניהם: מס הכנסה, ביטוח לאומי, מס בריאות והפקדה לפנסיה. פנסיה היא חיסכון בשבילך, לא מס!',
      activity: 'בקשו מההורים לראות תלוש שכר (בלי פרטים אישיים) ומצאו את השורות האלה.',
      quiz: [{ q: 'מה זה נטו?', options: ['מה שנכנס בפועל לחשבון', 'השכר לפני מסים', 'בונוס'], answer: 0 }],
    },
    en: {
      title: 'Your first paycheck',
      body: 'A payslip shows gross (what the employer pays) and net (what reaches your account). In between: income tax, national insurance, health tax and a pension deposit. A pension is savings for you, not a tax!',
      activity: 'Ask to see a payslip (personal details hidden) and find these lines.',
      quiz: [{ q: 'What is net pay?', options: ['What actually reaches your account', 'Pay before tax', 'A bonus'], answer: 0 }],
    },
  },
  {
    id: 'scams', band: 'teens', icon: '🛡️', stars: 6,
    he: {
      title: 'איך לא ליפול בעוקץ',
      body: '"תשואה מובטחת של 30% בחודש", "רק היום", "אל תספר לאף אחד". אלה סימני אזהרה קלאסיים. גוף השקעות אמיתי מפוקח על ידי רשות ניירות ערך או רשות שוק ההון, ואף פעם לא מבטיח תשואה.',
      activity: 'מצאו ברשת פרסומת חשודה וזהו בה שלושה סימני אזהרה.',
      quiz: [{ q: 'מה סימן אזהרה להונאה?', options: ['הבטחת תשואה גבוהה ובטוחה', 'גוף מפוקח', 'דוח שנתי מפורט'], answer: 0 }],
    },
    en: {
      title: 'How not to get scammed',
      body: '"Guaranteed 30% a month", "today only", "tell no one". Classic warning signs. A real investment house is supervised by the securities or capital-markets regulator and never guarantees returns.',
      activity: 'Find a suspicious ad online and spot three warning signs.',
      quiz: [{ q: 'Which is a scam warning sign?', options: ['A promised high, safe return', 'A regulated firm', 'A detailed annual report'], answer: 0 }],
    },
  },
  {
    id: 'your-21-plan', band: 'young', icon: '🎓', stars: 8,
    he: {
      title: 'התוכנית שלך לגיל 21',
      body: 'בגיל 21 החיסכון שלך עובר לשליטתך המלאה. לפני שמושכים, כדאי לחשוב: לימודים? דירה בעתיד? להמשיך להשקיע? משיכה חלקית אפשרית, ומה שנשאר ממשיך לגדול. שימו לב למס רווח הון של 25% על הרווח הריאלי במשיכה.',
      activity: 'כתבו שלוש מטרות לעשור הבא ושייכו לכל אחת סכום ומועד.',
      quiz: [
        { q: 'מה קורה לכסף שלא נמשך בגיל 21?', options: ['ממשיך להיות מושקע ולגדול', 'נעלם', 'עובר למדינה'], answer: 0 },
        { q: 'על מה משלמים מס רווח הון?', options: ['על הרווח', 'על כל הסכום', 'על ההפקדות'], answer: 0 },
      ],
    },
    en: {
      title: 'Your age-21 plan',
      body: 'At 21 your savings pass fully to you. Before withdrawing, think: studies? a future home? keep investing? Partial withdrawal is possible and the rest keeps growing. Note the 25% capital-gains tax on real gains when withdrawing.',
      activity: 'Write three goals for the next decade and attach an amount and a date to each.',
      quiz: [
        { q: 'What happens to money not withdrawn at 21?', options: ['It stays invested and grows', 'It disappears', 'It goes to the state'], answer: 0 },
        { q: 'What is capital-gains tax charged on?', options: ['The gain', 'The whole amount', 'The deposits'], answer: 0 },
      ],
    },
  },
  {
    id: 'pay-it-forward', band: 'young', icon: '🔁', stars: 8,
    he: {
      title: 'להעביר את זה הלאה',
      body: 'מישהו השקיע בעתיד שלך מיום שנולדת. עכשיו תורך: אפשר לתת מתנה עתידית לאחיינים, לחברים, או לתרום לילדים שאין להם מי שיחסוך בשבילם. הקוד שלך נשאר שלך לכל החיים.',
      activity: 'סרקו את הקוד של ילד במשפחה ושלחו לו מתנה ראשונה מכם.',
      quiz: [{ q: 'מה קורה לקוד ה־QR שלך אחרי גיל 21?', options: ['נשאר שלך לכל החיים', 'נמחק', 'עובר לאח הצעיר'], answer: 0 }],
    },
    en: {
      title: 'Pay it forward',
      body: 'Someone invested in your future from the day you were born. Now it is your turn: give a future-gift to nieces and nephews, friends, or children who have no one saving for them. Your code stays yours for life.',
      activity: 'Scan a younger relative\'s code and send them their first gift from you.',
      quiz: [{ q: 'What happens to your QR code after 21?', options: ['It stays yours for life', 'It is deleted', 'It goes to a sibling'], answer: 0 }],
    },
  },
];

export function lessonsFor(locale = 'he') {
  return LESSONS.map((l) => {
    const c = l[locale] || l.he;
    return { id: l.id, band: l.band, icon: l.icon, stars: l.stars, title: c.title, body: c.body, activity: c.activity, quiz: c.quiz.map(({ q, options }) => ({ q, options })) };
  });
}

export function gradeLesson(lessonId, answers) {
  const l = LESSONS.find((x) => x.id === lessonId);
  if (!l) return null;
  const quiz = l.he.quiz;
  const correct = quiz.filter((q, i) => Number(answers?.[i]) === q.answer).length;
  return { correct, total: quiz.length, passed: correct === quiz.length, stars: correct === quiz.length ? l.stars : 0 };
}
