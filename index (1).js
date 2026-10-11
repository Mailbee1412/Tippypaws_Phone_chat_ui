// Phone Chat UI — single-file build (lib.js inlined). Do not edit: generated from index.js + lib.js.
const { appStyle, buildModel, canonApp, cleanName, DEFAULT_APP, formatUserLine, hash, looksPhoneRelated, noAsterisks, parseAppList, parseExtraction, parseOneTag, parseStamp, parseTags, parseTime, parseWhen, plainText, TAG_HTML_RE, threadId, unreadCount } = (() => {
// ===== Phone Chat UI — pure helpers =====
// No DOM and no SillyTavern globals in here, so everything can be unit-tested in Node.
// The phone's content is *derived* from the story text: hidden tags the bot writes, e.g.
//   [[msg: Sender || App || text]]       incoming message
//   [[sent: Recipient || App || text]]   message the user sent
//   [[post: Author || App || text]]      social post the user sees
//   [[call: Caller]]                     incoming call
//   [[calendar: Title || when]]          appointment
// and lines the user typed on the phone:  📱 [App › Name] text

const DEFAULT_APP = 'Chat';

/* ------------------------------------------------------------------ */
/* small text helpers                                                  */
/* ------------------------------------------------------------------ */
const noAsterisks = (s) => String(s ?? '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

function hash(str) {
    const s = String(str ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

function cleanName(n) {
    return String(n ?? '').replace(/[[\]*"“”<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

function cleanText(s, max = 500) {
    let x = String(s ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    x = x.replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/g, '').trim();
    return x.slice(0, max);
}

const APP_ALIASES = [
    [/^(line|ไลน์|ไลน)$/i, 'LINE'],
    [/^(messenger|fb ?messenger|facebook messenger|เมสเซนเจอร์|เมสเสนเจอร์)$/i, 'Messenger'],
    [/^(sms|imessage|messages?|ข้อความ|ข้อความสั้น)$/i, 'SMS'],
    [/^(ig|instagram|อินสตาแกรม|อินสตา|ไอจี)$/i, 'IG'],
    [/^(whats ?app|วอทส์แอป|วอตส์แอป)$/i, 'WhatsApp'],
    [/^(fb|facebook|เฟซบุ๊ก|เฟซบุ๊ค|เฟสบุ๊ก|เฟสบุ๊ค|เฟสบุค)$/i, 'Facebook'],
    [/^(x|twitter|ทวิตเตอร์|ทวิต)$/i, 'X'],
    [/^(telegram|เทเลแกรม)$/i, 'Telegram'],
    [/^(discord|ดิสคอร์ด)$/i, 'Discord'],
    [/^(tiktok|ติ๊กตอก|ติ๊กต๊อก|ติ๊กต็อก)$/i, 'TikTok'],
    [/^(cg|catta ?gram|cattagram|แคตแกรม|แคทแกรม|แคทต้าแกรม|แคตต้าแกรม)$/i, 'CattaGram'],
];

// "ไลน์" / "line" -> "LINE"; empty -> DEFAULT_APP; unknown apps keep their own name
function canonApp(app) {
    const raw = String(app ?? '').replace(/[[\]*"“”<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!raw) return DEFAULT_APP;
    for (const [re, name] of APP_ALIASES) if (re.test(raw)) return name;
    return raw;
}

const threadId = (app, name) => `${canonApp(app).toLowerCase()}::${cleanName(name).toLowerCase()}`;

/* ------------------------------------------------------------------ */
/* message text -> plain text                                          */
/* ------------------------------------------------------------------ */
const TAG_NAMES = 'msg|message|sent|post|call|calendar';
const TAG_PARSE_SRC = `\\[\\[\\s*(${TAG_NAMES})\\s*(?::([\\s\\S]{0,600}?))?\\]\\]`;
const TAG_LOOSE_SRC = `\\[\\[\\s*(?:${TAG_NAMES})\\b[\\s\\S]{0,800}?\\]\\]`;

// matches a tag inside rendered HTML (markup such as <q> / <em> may sit between the brackets)
const TAG_HTML_RE = new RegExp(TAG_LOOSE_SRC, 'gi');
const TAG_STRIP_RE = new RegExp(TAG_LOOSE_SRC, 'gi');

function plainText(mes) {
    return String(mes ?? '')
        .replace(TAG_STRIP_RE, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\r/g, '')
        .trim();
}

/* ------------------------------------------------------------------ */
/* tags                                                                */
/* ------------------------------------------------------------------ */
function buildTag(typeRaw, body, k) {
    const t = String(typeRaw).toLowerCase();
    const parts = String(body ?? '').split('||').map((x) => x.trim());

    if (t === 'calendar') {
        if (parts.length < 2) return null;
        const whenRaw = parts[parts.length - 1];
        const title = cleanText(parts.slice(0, -1).join(' || '), 120);
        return title && whenRaw ? { type: 'calendar', k, title, whenRaw } : null;
    }
    if (t === 'call') return { type: 'call', k, name: cleanName(parts[0]), app: '', text: '' };

    const type = t === 'message' ? 'msg' : t;
    if (parts.length < 2) return null;
    const name = cleanName(parts[0]);
    let app = '';
    let text;
    if (parts.length >= 3) {
        app = parts[1] ? canonApp(parts[1]) : '';
        text = parts.slice(2).join(' || ');
    } else {
        text = parts[1];
    }
    text = cleanText(text, 500);
    return name && text ? { type, k, name, app, text } : null;
}

// every valid tag in a message, in order. `k` is stable per position (used to remember what was announced)
function parseTags(raw) {
    const s = String(raw ?? '');
    const re = new RegExp(TAG_PARSE_SRC, 'gi');
    const out = [];
    let m;
    let k = 0;
    while ((m = re.exec(s)) !== null) {
        const tag = buildTag(m[1], m[2], k);
        k += 1;
        if (tag) out.push(tag);
    }
    return out;
}

const parseOneTag = (text) => parseTags(text)[0] ?? null;

/* ------------------------------------------------------------------ */
/* lines the user typed on the phone                                   */
/* ------------------------------------------------------------------ */
const USER_LINE_RE = /^\s*📱\s*\[([^\]›]{0,40})›([^\]]{1,40})\]\s*([\s\S]*)$/;

function formatUserLine({ app, name, text, quote }) {
    const q = quote ? `↩ "${String(quote).replace(/["“”]/g, "'").replace(/\s+/g, ' ').trim().slice(0, 80)}" ` : '';
    return `📱 [${canonApp(app)} › ${cleanName(name)}] ${q}${String(text ?? '').trim()}`;
}

function parseUserLine(raw) {
    const m = String(raw ?? '').match(USER_LINE_RE);
    if (!m) return null;
    let text = m[3].trim();
    let quote = null;
    const q = text.match(/^↩\s*"([^"]*)"\s*([\s\S]*)$/);
    if (q) {
        quote = q[1];
        text = q[2].trim();
    }
    const name = cleanName(m[2]);
    return text && name ? { app: canonApp(m[1]), name, text, quote } : null;
}

/* ------------------------------------------------------------------ */
/* dates                                                               */
/* ------------------------------------------------------------------ */
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// SillyTavern's `send_date` comes in several shapes: epoch ms, ISO strings, and older chats
// ("June 3, 2023 4:29pm" / "2023-06-03@16h29m10s") that the browser's Date() cannot read.
function parseStamp(v) {
    if (v == null || v === '') return null;
    const valid = (d) => (d && !Number.isNaN(d.getTime()) ? d : null);
    if (typeof v === 'number') return valid(new Date(v));
    const s = String(v).trim();

    let d = valid(new Date(s));
    if (d) return d;

    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})@(\d{1,2})h\s*(\d{1,2})m(?:\s*(\d{1,2})s)?/i);
    if (m) return valid(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));

    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/i);
    if (m) {
        const mon = EN_MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
        if (mon >= 0) {
            let h = +m[4] % 12;
            if (m[7].toLowerCase() === 'p') h += 12;
            return valid(new Date(+m[3], mon, +m[2], h, +m[5], +(m[6] ?? 0)));
        }
    }

    // other UI languages: ST's own moment build knows the locale formats
    const mo = globalThis.SillyTavern?.libs?.moment;
    if (typeof mo === 'function') {
        const x = mo(s, ['LL LT', 'LLL', 'L LT', 'YYYY-MM-DD HH:mm'], false);
        if (x.isValid()) return valid(x.toDate());
    }
    return null;
}

/* ---------- natural-language date/time parser (EN + TH) ---------- */
const THAI_NUM = { 'สิบเอ็ด': 11, 'สิบสอง': 12, 'หนึ่ง': 1, 'นึง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9, 'สิบ': 10 };
const THAI_NUM_RE = new RegExp(Object.keys(THAI_NUM).join('|'), 'g');
const THAI_WEEKDAYS = [['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6]];
const EN_WEEKDAY_RE = /\b(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/;
const EN_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// -> { h, min } (h may be 24 = midnight of the next day) or null
function parseTime(s) {
    let m;
    let h = null;
    let min = 0;
    const ampm = (hh, mark) => {
        if (!mark) return hh;
        const pm = mark.startsWith('p');
        if (pm && hh < 12) return hh + 12;
        if (!pm && hh === 12) return 0;
        return hh;
    };
    if ((m = s.match(/(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/)) && +m[1] <= 24 && +m[2] < 60) {
        h = ampm(+m[1], m[3]);
        min = +m[2];
    } else if ((m = s.match(/(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/)) && +m[1] >= 1 && +m[1] <= 12) {
        h = ampm(+m[1], m[2]);
    } else if (/เที่ยงคืน|midnight/.test(s)) {
        h = 24;
    } else if (/เที่ยง|noon/.test(s)) {
        h = 12;
    } else if ((m = s.match(/ตี\s*(\d{1,2})/))) {
        h = +m[1];
    } else if ((m = s.match(/บ่าย\s*(\d{1,2})?\s*(โมง)?/)) && (m[1] || m[2])) {
        h = m[1] ? (+m[1] < 12 ? +m[1] + 12 : +m[1]) : 13; // บ่ายโมง = 13:00
    } else if ((m = s.match(/(\d{1,2})\s*โมง\s*(เช้า|เย็น)?/))) {
        const n = +m[1];
        if (m[2] === 'เย็น') h = n < 12 ? n + 12 : n;
        else if (m[2] === 'เช้า') h = n;
        else h = n <= 5 ? n + 12 : n; // "3 โมง" ~ 15:00, "6 โมง" ~ 06:00
    } else if ((m = s.match(/(?:(\d{1,2})\s*)?ทุ่ม(?:\s*(\d{1,2}))?/))) {
        const n = m[1] ?? m[2];
        h = n && +n <= 5 ? 18 + +n : 19;
    } else if (/morning|เช้า/.test(s)) {
        h = 9;
    } else if (/afternoon|บ่าย/.test(s)) {
        h = 14;
    } else if (/evening|เย็น/.test(s)) {
        h = 18;
    } else if (/night|ค่ำ|คืนนี้/.test(s)) {
        h = 20;
    }
    if (h === null || h > 24) return null;
    if (min === 0 && /ครึ่ง|half past/.test(s)) min = 30;
    return { h, min };
}

// Understands: 2026-10-08 18:00 · tomorrow 6pm · พรุ่งนี้บ่าย 3 · in 2 hours · อีก 30 นาที ·
// friday 19:30 · วันศุกร์ 2 ทุ่ม · next monday 9am · ... Falls back to Date.parse. Returns Date | null.
function parseWhen(raw, now = new Date()) {
    if (raw == null) return null;
    const original = String(raw).trim();
    if (!original) return null;

    // explicit timezone / UTC stamp -> trust the engine
    if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(:\d{2}(\.\d+)?)?(z|[+-]\d{2}:?\d{2})$/i.test(original)) {
        const d = new Date(original);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const s = original.toLowerCase().replace(THAI_NUM_RE, (w) => String(THAI_NUM[w])).replace(/\s+/g, ' ');
    let m;

    // relative: in 2 hours / +30m / อีก 3 วัน
    if ((m = s.match(/^(?:in|\+|อีก)\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|นาที|ชั่วโมง|ชม\.?|วัน)/))) {
        const n = parseFloat(m[1]);
        const u = m[2];
        const ms = /^(m|min|นาที)/.test(u) ? n * 60000 : /^(h|hr|ชม|ชั่วโมง)/.test(u) ? n * 3600000 : n * 86400000;
        return new Date(now.getTime() + ms);
    }

    const base = startOfDay(now);
    let dayGiven = false;
    let weekdayGiven = false;
    let rest = s;

    if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) {
        base.setFullYear(+m[1], +m[2] - 1, +m[3]);
        dayGiven = true;
        rest = s.slice(m[0].length);
    } else if (/day after tomorrow|มะรืน/.test(s)) {
        base.setDate(base.getDate() + 2);
        dayGiven = true;
    } else if (/tomorrow|tmr|พรุ่งนี้/.test(s)) {
        base.setDate(base.getDate() + 1);
        dayGiven = true;
    } else if (/today|tonight|วันนี้|คืนนี้/.test(s)) {
        dayGiven = true;
    } else {
        let wd = null;
        const en = s.match(EN_WEEKDAY_RE);
        if (en) wd = EN_WEEKDAYS.indexOf(en[1].slice(0, 3));
        else {
            const th = THAI_WEEKDAYS.find(([name]) => s.includes(name));
            if (th) wd = th[1];
        }
        if (wd !== null && wd >= 0) {
            let diff = (wd - base.getDay() + 7) % 7;
            if (diff === 0 && /next|หน้า|ถัดไป/.test(s)) diff = 7;
            base.setDate(base.getDate() + diff);
            dayGiven = true;
            weekdayGiven = true;
        }
    }

    const tm = parseTime(rest);
    const looksLikeFullDate = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{4}\b|\d{1,2}\/\d{1,2}/.test(s);
    if (!dayGiven && (!tm || looksLikeFullDate)) {
        const nat = new Date(original); // "October 12, 2026 6:00 PM" and other forms the engine understands
        if (!Number.isNaN(nat.getTime()) && nat.getFullYear() >= 2000) return nat;
        if (!tm) return null;
    }

    const d = new Date(base);
    if (tm) {
        d.setHours(tm.h % 24, tm.min, 0, 0);
        if (tm.h >= 24) d.setDate(d.getDate() + 1);
    } else {
        d.setHours(9, 0, 0, 0); // a day with no time -> 09:00
    }
    if (!dayGiven && d <= now) d.setDate(d.getDate() + 1); // bare time that already passed -> tomorrow
    if (weekdayGiven && d <= now) d.setDate(d.getDate() + 7);
    return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100 ? null : d;
}

/* ------------------------------------------------------------------ */
/* the phone model: everything the phone shows, derived from the chat  */
/* ------------------------------------------------------------------ */
// -> { threads: [{ id, name, app, items: [{ who: 'me'|'them', text, ts, idx, quote }], lastIdx, lastTs }], posts: [...] }
// threads are newest-first. `extracted` holds events the AI fallback found in tag-less messages
// ({ sig, t, name, app, text }, `sig` = hash of that message's text).
function buildModel(chat, { extracted = [] } = {}) {
    const events = [];
    const sigIdx = new Map();
    const tsList = [];

    (chat ?? []).forEach((m, idx) => {
        tsList[idx] = m ? (parseStamp(m.send_date)?.getTime() ?? null) : null;
        if (!m || m.is_system) return;
        const raw = String(m.mes ?? '');
        if (m.is_user) {
            const u = parseUserLine(raw);
            if (u) events.push({ kind: 'sent', name: u.name, app: u.app, text: u.text, quote: u.quote, idx, order: 0 });
            return;
        }
        sigIdx.set(hash(raw), idx);
        let order = 0;
        parseTags(raw).forEach((tag) => {
            if (tag.type === 'msg' || tag.type === 'sent' || tag.type === 'post') {
                events.push({ kind: tag.type, name: tag.name, app: tag.app, text: tag.text, quote: null, idx, order });
                order += 1;
            }
        });
    });

    (extracted ?? []).forEach((e, j) => {
        const idx = sigIdx.get(e?.sig);
        if (idx == null || !['msg', 'sent', 'post'].includes(e.t)) return;
        const name = cleanName(e.name);
        const text = cleanText(e.text, 500);
        if (!name || !text) return;
        events.push({ kind: e.t, name, app: e.app ? canonApp(e.app) : '', text, quote: null, idx, order: 100 + j });
    });

    events.sort((a, b) => a.idx - b.idx || a.order - b.order);

    // a tag without an app follows the app that person is already using
    const appOf = new Map();
    events.forEach((e) => { if (e.app) appOf.set(e.name.toLowerCase(), e.app); });
    events.forEach((e) => { if (!e.app) e.app = appOf.get(e.name.toLowerCase()) ?? DEFAULT_APP; });

    const threads = new Map();
    const posts = [];
    events.forEach((e) => {
        const ts = tsList[e.idx] ?? null;
        if (e.kind === 'post') {
            posts.push({ key: hash(`${e.name}|${e.app}|${e.text}`), author: e.name, app: e.app, text: e.text, ts, idx: e.idx });
            return;
        }
        const id = threadId(e.app, e.name);
        let th = threads.get(id);
        if (!th) {
            th = { id, name: e.name, app: e.app, items: [], lastIdx: -1, lastTs: 0 };
            threads.set(id, th);
        }
        th.items.push({ who: e.kind === 'sent' ? 'me' : 'them', text: e.text, ts, idx: e.idx, quote: e.quote ?? null });
        th.lastIdx = e.idx;
        if (ts != null) th.lastTs = ts;
    });

    return {
        threads: [...threads.values()].sort((a, b) => b.lastIdx - a.lastIdx),
        posts: posts.reverse(),
    };
}

const unreadCount = (th, readIdx) => th.items.filter((i) => i.who === 'them' && i.idx > readIdx).length;

/* ------------------------------------------------------------------ */
/* AI fallback: spotting phone talk in a story that wrote no tags      */
/* ------------------------------------------------------------------ */
const PHONE_WORDS_TH = /โทรศัพท์|มือถือ|สมาร์ทโฟน|สมาร์ตโฟน|ไอโฟน|แอนดรอยด์|เสียงแจ้งเตือน|แจ้งเตือน|ข้อความ(?:เด้ง|เข้า|ใหม่|จาก|หา)|ส่งข้อความ|ทักมา|ทักไป|ทักแชท|ไลน์|แชท|เมสเสจ|ดีเอ็ม|สายเรียกเข้า|เสียงเรียกเข้า|โทรหา|โทรมา|โทรเข้า|กดรับสาย|วางสาย|อินสตา|เฟซบุ๊ก|เมสเซนเจอร์|สตอรี่/;
const PHONE_WORDS_EN = /\b(?:phone|smartphone|cell ?phone|iphone|android|ringtone|notification|group chat|instagram|messenger|whatsapp|snapchat|tiktok|texts?|texted|texting|dm|dms|dmed)\b|\b(?:buzz|vibrat)\w*|new message|a message from|messag(?:e|ed|ing) (?:him|her|them|you|me)/i;

function looksPhoneRelated(text) {
    const s = String(text ?? '');
    return s.length > 0 && (PHONE_WORDS_TH.test(s) || PHONE_WORDS_EN.test(s));
}

// the AI's answer to the "phone check" prompt -> [{ t, name, app, text }]
function parseExtraction(reply) {
    const s = String(reply ?? '');
    const a = s.indexOf('[{');
    const b = s.lastIndexOf('}]');
    if (a < 0 || b < a) return [];
    let arr;
    try {
        arr = JSON.parse(s.slice(a, b + 2));
    } catch {
        return [];
    }
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const e of arr) {
        if (!e || typeof e !== 'object') continue;
        const t = String(e.t ?? e.type ?? '').toLowerCase();
        if (!['msg', 'sent', 'call', 'post'].includes(t)) continue;
        const name = cleanName(t === 'sent' ? (e.to ?? e.name ?? e.from) : (e.from ?? e.name ?? e.author ?? e.to));
        const text = cleanText(e.text ?? e.message ?? '', 400);
        if (!name) continue;
        if (t !== 'call' && !text) continue;
        out.push({ t, name, app: e.app ? canonApp(e.app) : '', text });
        if (out.length >= 4) break;
    }
    return out;
}

/* ------------------------------------------------------------------ */
/* the look of each chat app (generic glyphs + colours, no logos)       */
/* ------------------------------------------------------------------ */
const APP_STYLES = {
    line: { icon: 'fa-comment', color: '#07a94a', bg: 'linear-gradient(150deg, #34d97b, #06a447)' },
    sms: { icon: 'fa-message', color: '#3b82f6', bg: 'linear-gradient(150deg, #5aa2ff, #2f6fe0)' },
    ig: { icon: 'fa-camera', color: '#c13584', bg: 'linear-gradient(145deg, #feb47b, #e1306c 52%, #5b51d8)' },
    messenger: { icon: 'fa-comment-dots', color: '#7a5af8', bg: 'linear-gradient(150deg, #29b6ff, #a24bff)' },
    whatsapp: { icon: 'fa-comments', color: '#1fa855', bg: 'linear-gradient(150deg, #3fe07f, #129c4f)' },
    facebook: { icon: 'fa-thumbs-up', color: '#2f6fe0', bg: 'linear-gradient(150deg, #4c8dff, #1b57c9)' },
    x: { icon: 'fa-hashtag', color: '#5b6572', bg: 'linear-gradient(150deg, #4a5360, #1d2128)' },
    telegram: { icon: 'fa-paper-plane', color: '#229ed9', bg: 'linear-gradient(150deg, #44c0f5, #1b8bc7)' },
    discord: { icon: 'fa-headset', color: '#5865f2', bg: 'linear-gradient(150deg, #7b86ff, #4752d6)' },
    tiktok: { icon: 'fa-music', color: '#e8315a', bg: 'linear-gradient(150deg, #ff5d7e, #1b1b25)' },
    cattagram: { icon: 'fa-cat', color: '#ff8a3d', bg: 'linear-gradient(150deg, #ffb35c, #ff6b3d 55%, #e0457b)' },
};

// -> { icon, color, bg }; unknown apps get a neutral chat icon and null colours (the caller falls back to the accent)
function appStyle(app) {
    return APP_STYLES[canonApp(app).toLowerCase()] ?? { icon: 'fa-comment-dots', color: null, bg: null };
}

// "LINE, ไอจี ; sms" -> ['LINE', 'IG', 'SMS'] (no duplicates, empties dropped)
function parseAppList(text, max = 8) {
    const out = [];
    for (const part of String(text ?? '').split(/[,，、;\n]/)) {
        const raw = part.trim();
        if (!raw) continue;
        const app = canonApp(raw);
        if (!out.some((a) => a.toLowerCase() === app.toLowerCase())) out.push(app);
        if (out.length >= max) break;
    }
    return out;
}

return { DEFAULT_APP, noAsterisks, hash, cleanName, canonApp, threadId, TAG_HTML_RE, plainText, parseTags, parseOneTag, formatUserLine, parseUserLine, parseStamp, parseTime, parseWhen, buildModel, unreadCount, looksPhoneRelated, parseExtraction, appStyle, parseAppList };
})();
// ===== Phone Chat UI — SillyTavern extension (v2: a phone INSIDE the story) =====
// The story stays in SillyTavern's normal chat. This adds a phone: when the story has someone
// text / call / post to the user, a notification pops up and the phone shows the conversation
// (apps: Chat, Calls, Calendar, Social). Messages typed on the phone are sent into the story.
//
// The phone's contents are derived from hidden tags in the story text, e.g.
//   [[msg: Name || LINE || text]]  [[sent: ...]]  [[post: ...]]  [[call: Name]]  [[calendar: ...]]
// so swipes / edits / deletes / reloads can never leave it stale.
// Plain DOM only (no jQuery) and idle while the phone is closed.


const MODULE_NAME = 'phone_chat_ui';
const TAG = '[PhoneChatUI]';
const LANG = /^th/i.test(navigator.language || '') ? 'th' : 'en';
const LOCALE = LANG === 'th' ? 'th-TH-u-ca-gregory' : undefined; // Thai text, Gregorian years
const HOUR12 = LANG === 'th' ? false : undefined;

/* ------------------------------------------------------------------ */
/* strings                                                             */
/* ------------------------------------------------------------------ */
const STR = {
    th: {
        today: 'วันนี้', yesterday: 'เมื่อวาน', you: 'คุณ', online: 'ออนไลน์', typing: 'กำลังพิมพ์…',
        placeholder: 'พิมพ์ข้อความ…', replyingTo: (n) => `ตอบกลับ ${n}`, reply: 'ตอบกลับ',
        earlier: 'ดูข้อความก่อนหน้า', menu: 'หน้าจอโทรศัพท์',
        appChat: 'แชท', appCalls: 'โทร', appCal: 'ปฏิทิน', appSocial: 'โซเชียล',
        homeEmpty: 'ยังไม่มีข้อความ — เมื่อเนื้อเรื่องมีคนทักมา จะเด้งที่นี่',
        noThreads: 'ยังไม่มีห้องแชท กด + เพื่อทักใครสักคน', noCalls: 'ยังไม่มีประวัติการโทร', noPosts: 'ยังไม่มีโพสต์',
        recent: 'ล่าสุด', contacts: 'ผู้ติดต่อ', newChat: 'แชทใหม่', newName: 'ชื่อผู้ติดต่อ', newApp: 'แอป (เช่น LINE)', startChat: 'เริ่มแชท',
        story: 'ส่งไปในเนื้อเรื่องด้วย', draftHint: 'ข้อความนี้จะถูกส่งเข้าเนื้อเรื่อง',
        chipMsg: (n) => `ข้อความใหม่จาก ${n}`, chipSent: (n) => `คุณส่งข้อความหา ${n}`, chipPost: (n) => `${n} โพสต์`,
        chipCall: (n) => `สายเรียกเข้า${n ? `จาก ${n}` : ''}`, chipCal: (title) => `เพิ่มนัด: ${title}`,
        notifPost: (n) => `${n} โพสต์ใหม่`, like: 'ถูกใจ',
        calendar: 'ปฏิทิน', weekdays: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
        noEventsDay: 'ไม่มีนัดหมายในวันนี้', eventPlaceholder: 'ชื่อนัดหมาย…', add: 'เพิ่ม',
        byBot: 'เนื้อเรื่องนัด', byUser: 'คุณเพิ่ม',
        calling: 'กำลังโทร…', connecting: 'กำลังเชื่อมต่อ…', onCall: 'กำลังสนทนา', incoming: 'สายเรียกเข้า…',
        callPlaceholder: 'พูดอะไรสักอย่าง…', callGlitch: '(สัญญาณขัดข้อง ลองพูดอีกครั้ง)', speaking: 'กำลังพูด…',
        callOutDone: (d) => `โทรออก · ${d}`, callOutCancel: 'ยกเลิกการโทร',
        callInDone: (d) => `สายเรียกเข้า · ${d}`, callInDeclined: 'ปฏิเสธสาย', callInMissed: 'สายที่ไม่ได้รับ',
        remindPre: (title, m) => `อีก ${m} นาที: ${title}`, remindNow: (title) => `ถึงเวลานัดแล้ว: ${title}`,
        apptAdded: (title) => `เพิ่มนัดหมาย: ${title}`,
        busy: 'เนื้อเรื่องกำลังเล่าอยู่ รอสักครู่', noSendBox: 'หาช่องส่งข้อความของ SillyTavern ไม่เจอ',
        setNotifications: 'แจ้งเตือนข้อความ/โพสต์ใหม่',
        setReminders: 'เตือนนัดหมายในปฏิทิน',
        setInject: 'บอกบอทให้ส่งข้อความ/สาย/โพสต์เข้าโทรศัพท์ผ่านแท็กลับ พร้อมเวลาและนัดหมาย',
        setDetect: 'ถ้าบอทลืมใส่แท็ก ให้จับคำเกี่ยวกับมือถือในเนื้อเรื่องแล้วให้ AI สร้างข้อความให้ (ใช้โควตาเพิ่ม)',
        setChips: 'ซ่อนแท็กในแชทหลัก แสดงเป็นป้ายเล็กๆ ที่กดเปิดโทรศัพท์ได้',
        setSound: 'เสียงแจ้งเตือน', setAccent: 'สีธีม',
        setAutoOpen: 'เปิดแชทขึ้นมาเองทันทีที่มีข้อความเข้า (ไม่ต้องกดแบนเนอร์)',
        setFab: 'แสดงปุ่มโทรศัพท์ลอยพร้อมเลขข้อความที่ยังไม่อ่าน',
        setApps: 'แอปแชทที่โชว์บนหน้าจอโฮม (คั่นด้วย , เช่น LINE, IG, SMS)',
        setHidden: 'ซ่อนแอปเหล่านี้ (คั่นด้วย , เช่น CG) — ไม่แสดงไอคอน แชท และการแจ้งเตือนของแอปนั้น',
        allApps: 'ทุกแอป', openUnread: 'ข้อความที่ยังไม่อ่าน',
        testIncoming: 'ทดสอบสายเรียกเข้า', testNotif: 'ทดสอบแจ้งเตือน', testNotifText: 'นี่คือการแจ้งเตือนตัวอย่าง',
        hint: 'เปิดโทรศัพท์จากเมนูไม้กายสิทธิ์ (🪄) ข้างช่องพิมพ์ → "หน้าจอโทรศัพท์"',
    },
    en: {
        today: 'Today', yesterday: 'Yesterday', you: 'You', online: 'Online', typing: 'typing…',
        placeholder: 'Message…', replyingTo: (n) => `Replying to ${n}`, reply: 'Reply',
        earlier: 'Show earlier messages', menu: 'Phone',
        appChat: 'Chat', appCalls: 'Calls', appCal: 'Calendar', appSocial: 'Social',
        homeEmpty: 'No messages yet — when someone texts you in the story, it shows up here',
        noThreads: 'No chats yet. Tap + to message someone', noCalls: 'No calls yet', noPosts: 'No posts yet',
        recent: 'Recent', contacts: 'Contacts', newChat: 'New chat', newName: 'Contact name', newApp: 'App (e.g. LINE)', startChat: 'Start chat',
        story: 'Also sent into the story', draftHint: 'This message is sent into the story',
        chipMsg: (n) => `New message from ${n}`, chipSent: (n) => `You texted ${n}`, chipPost: (n) => `${n} posted`,
        chipCall: (n) => `Incoming call${n ? ` from ${n}` : ''}`, chipCal: (title) => `Appointment: ${title}`,
        notifPost: (n) => `${n} posted`, like: 'Like',
        calendar: 'Calendar', weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        noEventsDay: 'No appointments this day', eventPlaceholder: 'Appointment title…', add: 'Add',
        byBot: 'set by the story', byUser: 'added by you',
        calling: 'Calling…', connecting: 'Connecting…', onCall: 'On call', incoming: 'Incoming call…',
        callPlaceholder: 'Say something…', callGlitch: '(bad connection, try again)', speaking: 'speaking…',
        callOutDone: (d) => `Outgoing call · ${d}`, callOutCancel: 'Call cancelled',
        callInDone: (d) => `Incoming call · ${d}`, callInDeclined: 'Declined call', callInMissed: 'Missed call',
        remindPre: (title, m) => `In ${m} min: ${title}`, remindNow: (title) => `It's time: ${title}`,
        apptAdded: (title) => `Appointment added: ${title}`,
        busy: 'The story is still being written, one moment', noSendBox: 'Could not find SillyTavern\'s send box',
        setNotifications: 'Notify on new messages / posts',
        setReminders: 'Calendar reminders',
        setInject: 'Tell the bot how to send messages / calls / posts to the phone via hidden tags, plus time and appointments',
        setDetect: 'If the bot forgets the tags, spot phone-related words in the story and have the AI write the message (uses extra quota)',
        setChips: 'Hide tags in the main chat and show small chips that open the phone',
        setSound: 'Notification sound', setAccent: 'Accent color',
        setAutoOpen: 'Open the chat right away when a message arrives (no need to tap the banner)',
        setFab: 'Show a floating phone button with the unread count',
        setApps: 'Chat apps shown on the home screen (comma separated, e.g. LINE, IG, SMS)',
        setHidden: 'Hide these apps (comma separated, e.g. CG) — no icon, chats or notifications for them',
        allApps: 'All apps', openUnread: 'Unread messages',
        testIncoming: 'Test incoming call', testNotif: 'Test notification', testNotifText: 'This is a sample notification',
        hint: 'Open the phone from the wand (🪄) menu next to the input box → "Phone"',
    },
};
const t = (key, ...args) => {
    const v = STR[LANG][key] ?? STR.en[key] ?? key;
    return typeof v === 'function' ? v(...args) : v;
};

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */
const $id = (id) => document.getElementById(id);
const ctx = () => SillyTavern.getContext();
const pad = (n) => String(n).padStart(2, '0');
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
}

const fmtClock = (d) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: HOUR12 });
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const inputLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDuration = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
const EN_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function fmtDay(d) {
    const now = new Date();
    if (sameDay(d, now)) return t('today');
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return t('yesterday');
    return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
// time for list rows: clock today, otherwise the day
const fmtWhenShort = (d) => (sameDay(d, new Date()) ? fmtClock(d) : fmtDay(d));

function toast(msg, kind = 'info') {
    try { globalThis.toastr?.[kind]?.(msg); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* settings (global) and chat metadata (per chat)                      */
/* ------------------------------------------------------------------ */
const DEFAULTS = Object.freeze({
    notifications: true,
    reminders: true,
    injectContext: true,
    autoDetect: true,
    hideTags: true,
    sound: false,
    autoOpen: false,
    fab: true,
    apps: 'LINE, Messenger, SMS, IG',
    hiddenApps: '',
    accent: '#4a7dfc',
});

function S() {
    const { extensionSettings } = ctx();
    const cur = (extensionSettings[MODULE_NAME] ??= {});
    for (const k of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(cur, k)) cur[k] = DEFAULTS[k];
    }
    return cur;
}
const saveSettings = () => ctx().saveSettingsDebounced?.();

// Always re-read: the chatMetadata reference changes whenever the chat changes.
const scratchMeta = { events: [], calls: [], read: {}, likes: {}, extracted: [], baseline: null, readPosts: -1 };
function meta() {
    const md = ctx().chatMetadata;
    if (!md) return scratchMeta; // no chat open: detached scratch object
    const m = (md[MODULE_NAME] ??= {});
    m.events ??= [];
    m.calls ??= [];
    m.read ??= {};
    m.likes ??= {};
    m.extracted ??= [];
    m.readPosts ??= -1;
    if (m.baseline === undefined) m.baseline = null;
    return m;
}
const persist = () => ctx().saveMetadata?.();
let persistTimer = null;
function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persist(), 700);
}

// messages that already existed when the extension first saw this chat count as read
function ensureBaseline() {
    if (!ctx().chatMetadata) return;
    const m = meta();
    if (m.baseline == null) {
        m.baseline = (ctx().chat?.length ?? 0) - 1;
        persistSoon();
    }
}
const readIdx = (tid) => Math.max(meta().read[tid] ?? -1, meta().baseline ?? -1);

/* ------------------------------------------------------------------ */
/* the phone model (derived from the chat text)                        */
/* ------------------------------------------------------------------ */
let modelCache = null;
const markDirty = () => { modelCache = null; };
const hiddenApps = () => new Set(parseAppList(S().hiddenApps, 20).map((a) => a.toLowerCase()));

function model() {
    const chat = ctx().chat ?? [];
    if (!modelCache || modelCache.len !== chat.length) {
        const built = buildModel(chat, { extracted: meta().extracted });
        const hide = hiddenApps();
        if (hide.size) {
            built.threads = built.threads.filter((th) => !hide.has(th.app.toLowerCase()));
            built.posts = built.posts.filter((p) => !hide.has(String(p.app ?? '').toLowerCase()));
        }
        modelCache = { ...built, len: chat.length };
    }
    return modelCache;
}

function markThreadRead(th) {
    if (!th || th.lastIdx < 0) return;
    const m = meta();
    if ((m.read[th.id] ?? -1) < th.lastIdx) {
        m.read[th.id] = th.lastIdx;
        persistSoon();
    }
}

/* ------------------------------------------------------------------ */
/* character / avatar info                                             */
/* ------------------------------------------------------------------ */
const avatarSrc = (file) => (file ? `/thumbnail?type=avatar&file=${encodeURIComponent(file)}` : '');
const userName = () => ctx().name1 || 'You';

function currentChar() {
    const c = ctx();
    return c.characterId != null ? c.characters?.[c.characterId] ?? null : null;
}
function charByName(name) {
    return ctx().characters?.find((c) => c?.name && sameName(c.name, name)) ?? null;
}
function headerInfo() {
    const c = ctx();
    if (c.groupId) {
        const g = c.groups?.find((x) => String(x.id) === String(c.groupId));
        return { name: g?.name || 'Group', file: null };
    }
    const ch = currentChar();
    return { name: c.name2 || ch?.name || 'Character', file: ch?.avatar ?? null };
}
function contactFor(name) {
    const ch = charByName(name);
    return { name: cleanName(name), file: ch?.avatar ?? null };
}

// names of the people the user may know: the card's characters (a card may voice several), group members, anyone in a thread
function knownContacts() {
    const names = new Map();
    const add = (n) => {
        const v = cleanName(n);
        if (v && !sameName(v, userName())) names.set(v.toLowerCase(), v);
    };
    const c = ctx();
    if (c.groupId) {
        const g = c.groups?.find((x) => String(x.id) === String(c.groupId));
        (g?.members ?? []).forEach((file) => add(c.characters?.find((ch) => ch?.avatar === file)?.name));
    } else {
        String(c.name2 ?? '').split(/\s*(?:,|،|、|&|\/| และ )\s*/).forEach(add);
    }
    model().threads.forEach((th) => add(th.name));
    return [...names.values()];
}

const hueOf = (s) => [...String(s ?? '')].reduce((a, ch) => (a + ch.charCodeAt(0)) % 360, 0);

// initial letter first (skipping Thai leading vowels), swapped for the real picture once it has loaded
function setAvatar(node, name, file) {
    node.textContent = '';
    const raw = String(name || '?').trim();
    const ch = (raw.replace(/^[เแโใไ]+/, '').charAt(0) || raw.charAt(0) || '?').toUpperCase();
    node.appendChild(el('span', null, ch));
    node.style.background = `linear-gradient(135deg, hsl(${hueOf(raw)} 30% 34%), hsl(${hueOf(raw)} 30% 22%))`;
    if (!file) return;
    const img = new Image();
    img.alt = '';
    img.onload = () => {
        node.textContent = '';
        node.appendChild(img);
    };
    img.src = avatarSrc(file);
}

function fillRich(node, text) {
    node.textContent = '';
    String(text).replace(/\*\*+/g, '*').split(/(\*[^*\n]+\*)/g).forEach((chunk) => {
        if (!chunk) return;
        if (/^\*[^*\n]+\*$/.test(chunk)) node.appendChild(el('em', null, chunk.slice(1, -1)));
        else node.appendChild(document.createTextNode(chunk));
    });
}

/* ------------------------------------------------------------------ */
/* runtime state                                                       */
/* ------------------------------------------------------------------ */
const state = {
    open: false,
    screen: 'home',
    appFilter: null, // chat list shows only this app (null = every app)
    threadId: null,
    virtual: null, // a thread the user is starting (no messages yet)
    pending: [], // messages typed on the phone that SillyTavern has not rendered yet
    generating: false,
    genAt: 0,
    awaiting: null, // thread id the user just wrote to while the story is being generated
    replyTo: null,
    renderLimit: 80,
    calMonth: null,
    calSel: null,
    call: null,
    ringing: null,
    clockTimer: null,
    notified: new Set(),
    notifRoute: null,
    detecting: false,
    lastDetectAt: 0,
    booted: false,
};
const isPhoneOpen = () => state.open;

// the chat apps (LINE, IG, ...) come from the settings + the story; these are the fixed ones
const APPS = [
    { id: 'calls', icon: 'fa-phone', label: 'appCalls', cls: 'pcu-ic-calls' },
    { id: 'calendar', icon: 'fa-calendar-days', label: 'appCal', cls: 'pcu-ic-cal' },
    { id: 'social', icon: 'fa-heart', label: 'appSocial', cls: 'pcu-ic-social' },
];

/* ------------------------------------------------------------------ */
/* DOM skeleton                                                        */
/* ------------------------------------------------------------------ */
const headerHtml = (title, extra = '') => `
    <div class="pcu-header">
        <button class="pcu-icon" data-act="back" type="button" aria-label="Back"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="pcu-title"><div class="name">${title}</div></div>${extra}
    </div>`;

function buildSkeleton() {
    if ($id('pcu_root')) return;

    const root = el('div');
    root.id = 'pcu_root';
    root.innerHTML = `
    <div class="pcu-phone" id="pcu_phone">
        <div class="pcu-status"><span id="pcu_clock"></span><span id="pcu_date"></span></div>

        <section class="pcu-screen pcu-home" data-screen="home">
            <div class="pcu-home-bar"><button class="pcu-icon" data-act="close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="pcu-widget"><div class="pcu-w-time" id="pcu_w_time"></div><div class="pcu-w-date" id="pcu_w_date"></div></div>
            <div class="pcu-apps" id="pcu_apps"></div>
            <div class="pcu-home-hint" id="pcu_home_hint"></div>
        </section>

        <section class="pcu-screen" data-screen="chat" hidden>
            ${headerHtml('<span id="pcu_chat_title"></span>', '<button class="pcu-icon" data-act="new-chat" type="button" aria-label="New chat"><i class="fa-solid fa-plus"></i></button>')}
            <div class="pcu-list" id="pcu_chat_list"></div>
        </section>

        <section class="pcu-screen" data-screen="new" hidden>
            ${headerHtml('<span id="pcu_new_title"></span>')}
            <div class="pcu-form">
                <input type="text" id="pcu_new_name" maxlength="30" list="pcu_dl_names" autocomplete="off">
                <input type="text" id="pcu_new_app" maxlength="20" list="pcu_dl_apps" autocomplete="off">
                <datalist id="pcu_dl_names"></datalist>
                <datalist id="pcu_dl_apps"></datalist>
                <button class="pcu-wide-btn" id="pcu_new_go" type="button"></button>
            </div>
        </section>

        <section class="pcu-screen" data-screen="thread" hidden>
            <div class="pcu-header">
                <button class="pcu-icon" data-act="back" type="button" aria-label="Back"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="pcu-av pcu-av-md" id="pcu_h_av"></div>
                <div class="pcu-title"><div class="name" id="pcu_h_name"></div><div class="sub" id="pcu_h_sub"></div></div>
                <button class="pcu-icon" data-act="call-thread" type="button" aria-label="Call"><i class="fa-solid fa-phone"></i></button>
            </div>
            <div class="pcu-messages" id="pcu_msgs"></div>
            <div class="pcu-replybar" id="pcu_replybar" hidden>
                <div class="pcu-replytext"><b id="pcu_reply_name"></b><span id="pcu_reply_snip"></span></div>
                <button class="pcu-icon" id="pcu_reply_x" type="button" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pcu-composer">
                <textarea id="pcu_input" rows="1"></textarea>
                <button class="pcu-send" id="pcu_send" type="button" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </section>

        <section class="pcu-screen" data-screen="calls" hidden>
            ${headerHtml('<span id="pcu_calls_title"></span>')}
            <div class="pcu-list" id="pcu_calls_list"></div>
        </section>

        <section class="pcu-screen" data-screen="social" hidden>
            ${headerHtml('<span id="pcu_social_title"></span>')}
            <div class="pcu-list pcu-feed" id="pcu_feed"></div>
        </section>

        <section class="pcu-screen pcu-cal" data-screen="calendar" hidden>
            <div class="pcu-header">
                <button class="pcu-icon" data-act="back" type="button" aria-label="Back"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="pcu-title"><div class="name" id="pcu_cal_head"></div></div>
                <button class="pcu-icon" id="pcu_cal_prev" type="button"><i class="fa-solid fa-angle-left"></i></button>
                <button class="pcu-icon" id="pcu_cal_next" type="button"><i class="fa-solid fa-angle-right"></i></button>
            </div>
            <div class="pcu-cal-grid" id="pcu_cal_grid"></div>
            <div class="pcu-cal-list" id="pcu_cal_list"></div>
            <div class="pcu-cal-add">
                <input type="text" id="pcu_cal_title" maxlength="120">
                <input type="datetime-local" id="pcu_cal_when">
                <button class="pcu-send" id="pcu_cal_add" type="button" aria-label="Add"><i class="fa-solid fa-plus"></i></button>
            </div>
        </section>

        <div class="pcu-overlay pcu-call" id="pcu_call" hidden>
            <div class="pcu-call-top">
                <div class="pcu-av pcu-av-xl" id="pcu_call_av"></div>
                <div class="pcu-call-name" id="pcu_call_name"></div>
                <div class="pcu-call-status" id="pcu_call_status"></div>
            </div>
            <div class="pcu-call-log" id="pcu_call_log"></div>
            <div class="pcu-call-bottom">
                <div class="pcu-call-inputrow">
                    <input type="text" id="pcu_call_input" autocomplete="off">
                    <button class="pcu-send" id="pcu_call_send" type="button" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <button class="pcu-round pcu-red" id="pcu_call_end" type="button" aria-label="Hang up"><i class="fa-solid fa-phone-slash"></i></button>
            </div>
        </div>

        <div class="pcu-overlay pcu-ring" id="pcu_ring" hidden>
            <div class="pcu-call-top">
                <div class="pcu-av pcu-av-xl pcu-pulse" id="pcu_ring_av"></div>
                <div class="pcu-call-name" id="pcu_ring_name"></div>
                <div class="pcu-call-status" id="pcu_ring_status"></div>
            </div>
            <div class="pcu-ring-buttons">
                <button class="pcu-round pcu-red" id="pcu_ring_no" type="button" aria-label="Decline"><i class="fa-solid fa-phone-slash"></i></button>
                <button class="pcu-round pcu-green" id="pcu_ring_yes" type="button" aria-label="Accept"><i class="fa-solid fa-phone"></i></button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(root);

    const notif = el('div');
    notif.id = 'pcu_notif';
    notif.setAttribute('role', 'status');
    notif.innerHTML = `<div class="pcu-av pcu-av-md" id="pcu_n_av"></div>
        <div class="pcu-n-body"><div class="pcu-n-top"><b id="pcu_n_name"></b><span id="pcu_n_time"></span></div><div class="pcu-n-text" id="pcu_n_text"></div></div>`;
    document.body.appendChild(notif);

    const fab = el('button');
    fab.id = 'pcu_fab';
    fab.type = 'button';
    fab.hidden = true;
    fab.setAttribute('aria-label', t('openUnread'));
    fab.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i><b id="pcu_fab_n"></b>';
    document.body.appendChild(fab);

    $id('pcu_input').placeholder = t('placeholder');
    $id('pcu_cal_title').placeholder = t('eventPlaceholder');
    $id('pcu_call_input').placeholder = t('callPlaceholder');
    $id('pcu_cal_head').textContent = t('calendar');
    $id('pcu_calls_title').textContent = t('appCalls');
    $id('pcu_social_title').textContent = t('appSocial');
    $id('pcu_new_title').textContent = t('newChat');
    $id('pcu_new_name').placeholder = t('newName');
    $id('pcu_new_app').placeholder = t('newApp');
    $id('pcu_new_go').textContent = t('startChat');
    $id('pcu_home_hint').textContent = t('homeEmpty');
    wireHandlers();
}

/* ------------------------------------------------------------------ */
/* clock                                                               */
/* ------------------------------------------------------------------ */
function tickClock() {
    const now = new Date();
    const set = (id, v) => { const n = $id(id); if (n) n.textContent = v; };
    set('pcu_clock', fmtClock(now));
    set('pcu_date', now.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }));
    set('pcu_w_time', fmtClock(now));
    set('pcu_w_date', now.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
}
function startClock() {
    tickClock();
    clearInterval(state.clockTimer);
    state.clockTimer = setInterval(tickClock, 15000);
}
function stopClock() {
    clearInterval(state.clockTimer);
    state.clockTimer = null;
}

/* ------------------------------------------------------------------ */
/* unread indicator: floating button + badge on the wand-menu entry     */
/* ------------------------------------------------------------------ */
function unreadThreads() {
    return model().threads.filter((th) => unreadCount(th, readIdx(th.id)) > 0);
}

function updateFab() {
    const fab = $id('pcu_fab');
    const mb = $id('pcu_menu_badge');
    if (!fab && !mb) return;
    let total = 0;
    try {
        total = unreadThreads().reduce((n, th) => n + unreadCount(th, readIdx(th.id)), 0)
            + meta().calls.filter((c) => c.direction === 'in' && c.status !== 'answered' && !c.seen).length;
    } catch (err) {
        console.warn(TAG, 'unread count failed', err);
    }
    const label = total > 99 ? '99+' : String(total);
    if (fab) {
        fab.hidden = !S().fab || state.open || !total;
        $id('pcu_fab_n').textContent = label;
    }
    if (mb) {
        mb.hidden = !total;
        mb.textContent = label;
    }
}

// one unread chat -> straight into it, otherwise the home screen
function openFromFab() {
    const un = unreadThreads();
    if (un.length === 1) openThread(un[0].name, un[0].app);
    else openPhone();
}

/* ------------------------------------------------------------------ */
/* navigation                                                          */
/* ------------------------------------------------------------------ */
function currentThread() {
    const th = model().threads.find((x) => x.id === state.threadId);
    if (th) return th;
    return state.virtual && state.virtual.id === state.threadId ? state.virtual : null;
}

function go(screen, opts = {}) {
    if (!$id('pcu_phone')) return;
    if (opts.thread) state.threadId = opts.thread;
    if (screen === 'thread' && !currentThread()) screen = 'chat';
    state.screen = screen;
    document.querySelectorAll('#pcu_phone .pcu-screen').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
    refreshScreen('bottom');
    if (screen === 'thread') $id('pcu_input')?.focus({ preventScroll: true });
}

function goBack() {
    if (state.call || state.ringing) return;
    if (state.screen === 'thread') go('chat');
    else if (state.screen === 'new') go('chat');
    else if (state.screen === 'home') closePhone();
    else go('home');
}

// a tag that names no app belongs to the conversation that person already has
function resolveThread(name, app = '') {
    const threads = model().threads;
    if (!app) {
        const known = threads.find((x) => sameName(x.name, name));
        if (known) return known;
    }
    const id = threadId(app, name);
    return threads.find((x) => x.id === id) ?? { id, name: cleanName(name), app: canonApp(app), items: [], lastIdx: -1, lastTs: 0 };
}

function openThread(name, app = '') {
    const th = resolveThread(name, app);
    if (!model().threads.some((x) => x.id === th.id)) state.virtual = th;
    state.appFilter = th.app; // "back" lands on that app's chat list
    openPhone({ screen: 'thread', thread: th.id });
}

function openRoute(route) {
    if (!route) return openPhone();
    if (route.screen === 'thread' && route.name) return openThread(route.name, route.app);
    return openPhone(route);
}

function openPhone(route = null) {
    buildSkeleton();
    state.open = true;
    $id('pcu_root').classList.add('pcu-visible');
    fitViewport();
    startClock();
    hideNotification();
    go(route?.screen ?? 'home', route ?? {});
    $id('pcu_toggle_button')?.classList.add('pcu-active');
    updateFab();
}

function closePhone() {
    if (state.call || state.ringing) return; // finish the call first
    state.open = false;
    $id('pcu_root')?.classList.remove('pcu-visible');
    stopClock();
    $id('pcu_toggle_button')?.classList.remove('pcu-active');
    updateFab();
}
const togglePhone = () => (state.open ? closePhone() : openPhone());

function fitViewport() {
    const root = $id('pcu_root');
    const vv = window.visualViewport;
    if (!root) return;
    root.style.height = vv ? `${vv.height}px` : '';
    root.style.top = vv ? `${vv.offsetTop}px` : '';
}

function refreshScreen(mode = 'auto') {
    if (!state.open) return;
    switch (state.screen) {
        case 'home': renderHome(); break;
        case 'chat': renderChatList(); break;
        case 'new': renderNewChat(); break;
        case 'thread': renderThread(mode); break;
        case 'calls': renderCalls(); break;
        case 'social': renderSocial(); break;
        case 'calendar': openCalendarScreen(); break;
        default: break;
    }
}

let rafId = 0;
let rafMode = 'auto';
function scheduleRefresh(mode = 'auto') {
    if (!state.open) { updateFab(); return; }
    if (mode === 'bottom') rafMode = 'bottom';
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        rafId = 0;
        const m = rafMode;
        rafMode = 'auto';
        if (state.screen === 'calendar') { renderCalendar(); return; }
        refreshScreen(m);
    });
}

/* ------------------------------------------------------------------ */
/* home                                                                */
/* ------------------------------------------------------------------ */
// every chat app we know of: the user's list first, then any app the story has used
function chatApps() {
    const hide = hiddenApps();
    const apps = parseAppList(S().apps).filter((a) => !hide.has(a.toLowerCase()));
    model().threads.forEach((th) => {
        if (!apps.some((a) => sameApp(a, th.app))) apps.push(th.app);
    });
    const v = state.virtual;
    if (v && !apps.some((a) => sameApp(a, v.app))) apps.push(v.app);
    return apps;
}

const sameApp = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

function appTile({ key, icon, label, cls = '', style = null, count = 0, data }) {
    const b = el('button', 'pcu-app');
    b.type = 'button';
    Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
    const ic = el('span', `pcu-app-ic ${cls}`.trim());
    if (style?.bg) ic.style.background = style.bg;
    ic.appendChild(el('i', `fa-solid ${icon}`));
    const badge = el('b', 'pcu-badge', count > 99 ? '99+' : String(count));
    badge.hidden = !count;
    ic.appendChild(badge);
    b.appendChild(ic);
    b.appendChild(el('span', 'pcu-app-name', label));
    b.dataset.key = key;
    return b;
}

function renderHome() {
    tickClock();
    const mdl = model();
    const m = meta();
    const now = new Date();
    const postsRead = Math.max(m.readPosts ?? -1, m.baseline ?? -1);
    const newPosts = mdl.posts.filter((p) => p.idx > postsRead).length;
    const missed = m.calls.filter((c) => c.direction === 'in' && c.status !== 'answered' && !c.seen).length;
    const today = m.events.filter((e) => sameDay(new Date(e.whenISO), now)).length;
    const counts = { calls: missed, calendar: today, social: newPosts };

    const grid = $id('pcu_apps');
    grid.textContent = '';
    chatApps().forEach((app) => {
        const un = mdl.threads.filter((th) => sameApp(th.app, app)).reduce((n, th) => n + unreadCount(th, readIdx(th.id)), 0);
        const st = appStyle(app);
        grid.appendChild(appTile({ key: `app:${app}`, icon: st.icon, label: app, cls: st.bg ? '' : 'pcu-ic-chat', style: st, count: un, data: { app } }));
    });
    APPS.forEach((a) => grid.appendChild(appTile({ key: a.id, icon: a.icon, label: t(a.label), cls: a.cls, count: counts[a.id] ?? 0, data: { open: a.id } })));
    $id('pcu_home_hint').hidden = mdl.threads.length > 0 || mdl.posts.length > 0;
}

/* ------------------------------------------------------------------ */
/* chat list + new chat                                                */
/* ------------------------------------------------------------------ */
function listRow({ name, file, title, sub, right, badge, onClick }) {
    const row = el('button', 'pcu-li');
    row.type = 'button';
    const av = el('div', 'pcu-av pcu-av-md');
    setAvatar(av, name, file);
    row.appendChild(av);
    const body = el('div', 'pcu-li-body');
    body.appendChild(title);
    if (sub) body.appendChild(sub);
    row.appendChild(body);
    const end = el('div', 'pcu-li-end');
    if (right) end.appendChild(right);
    if (badge) end.appendChild(badge);
    row.appendChild(end);
    if (onClick) row.addEventListener('click', onClick);
    return row;
}

function nameWithApp(name, app) {
    const top = el('div', 'pcu-li-top');
    top.appendChild(el('b', null, name));
    if (app) top.appendChild(el('span', 'pcu-pill', app));
    return top;
}

function renderChatList() {
    const list = $id('pcu_chat_list');
    if (!list) return;
    list.textContent = '';
    const filter = state.appFilter;
    const st = filter ? appStyle(filter) : null;
    $id('pcu_chat_title').textContent = filter ?? t('allApps');
    const threads = model().threads.filter((th) => !filter || sameApp(th.app, filter));
    if (!threads.length) list.appendChild(el('div', 'pcu-empty', t('noThreads')));
    threads.forEach((th) => {
        const last = th.items[th.items.length - 1];
        const un = unreadCount(th, readIdx(th.id));
        const preview = `${last.who === 'me' ? `${t('you')}: ` : ''}${noAsterisks(last.text)}`;
        list.appendChild(listRow({
            name: th.name,
            file: contactFor(th.name).file,
            title: nameWithApp(th.name, filter && st ? '' : th.app),
            sub: el('div', `pcu-li-sub${un ? ' pcu-strong' : ''}`, preview),
            right: last.ts != null ? el('span', 'pcu-li-time', fmtWhenShort(new Date(last.ts))) : null,
            badge: un ? el('b', 'pcu-badge pcu-badge-in', String(un)) : null,
            onClick: () => go('thread', { thread: th.id }),
        }));
    });
}

function renderNewChat() {
    const dl = $id('pcu_dl_names');
    dl.textContent = '';
    knownContacts().forEach((n) => { const o = el('option'); o.value = n; dl.appendChild(o); });
    const da = $id('pcu_dl_apps');
    da.textContent = '';
    chatApps().forEach((n) => { const o = el('option'); o.value = n; da.appendChild(o); });
    const last = model().threads[0];
    $id('pcu_new_app').value = state.appFilter ?? last?.app ?? parseAppList(S().apps)[0] ?? DEFAULT_APP;
}

function startNewChat() {
    const name = cleanName($id('pcu_new_name').value);
    if (!name) { $id('pcu_new_name').focus(); return; }
    const app = canonApp($id('pcu_new_app').value);
    $id('pcu_new_name').value = '';
    openThread(name, app);
}

/* ------------------------------------------------------------------ */
/* thread view (a conversation with one contact)                       */
/* ------------------------------------------------------------------ */
function callLabel(cl) {
    const d = fmtDuration(cl.durationSec || 0);
    if (cl.direction === 'out') return cl.status === 'answered' ? t('callOutDone', d) : t('callOutCancel');
    if (cl.status === 'answered') return t('callInDone', d);
    return cl.status === 'declined' ? t('callInDeclined') : t('callInMissed');
}

function threadItems(th) {
    const items = th.items.map((it) => ({ kind: 'msg', who: it.who === 'me' ? 'user' : 'bot', text: it.text, quote: it.quote, ts: it.ts != null ? new Date(it.ts) : null }));
    const nowMs = Date.now();
    state.pending = state.pending.filter((p) => nowMs - p.at < 15000);
    state.pending.filter((p) => p.tid === th.id).forEach((p) => items.push({ kind: 'msg', who: 'user', text: p.text, quote: p.quote, ts: new Date(p.at) }));
    const cardName = headerInfo().name;
    meta().calls
        .filter((c) => sameName(c.name ?? cardName, th.name))
        .sort((a, b) => a.startMs - b.startMs)
        .forEach((cl) => {
            const entry = { kind: 'call', call: cl, ts: new Date(cl.startMs) };
            const at = items.findIndex((it) => it.kind === 'msg' && it.ts && it.ts.getTime() > cl.startMs);
            if (at === -1) items.push(entry);
            else items.splice(at, 0, entry);
        });
    return items;
}

function updateThreadHeader(th) {
    $id('pcu_h_name').textContent = th.name;
    const typing = state.generating && state.awaiting === th.id;
    const sub = $id('pcu_h_sub');
    sub.textContent = typing ? t('typing') : `${th.app} · ${t('online')}`;
    sub.classList.toggle('pcu-live', !typing);
    setAvatar($id('pcu_h_av'), th.name, contactFor(th.name).file);
}

function renderThread(mode = 'auto') {
    const th = currentThread();
    const box = $id('pcu_msgs');
    if (!box || !th) return;
    const stick = mode === 'bottom' || (mode === 'auto' && box.scrollHeight - box.scrollTop - box.clientHeight < 140);

    const all = threadItems(th);
    const hidden = Math.max(0, all.length - state.renderLimit);
    const items = hidden ? all.slice(hidden) : all;
    const frag = document.createDocumentFragment();

    if (hidden) {
        const more = el('button', 'pcu-more', t('earlier'));
        more.type = 'button';
        more.addEventListener('click', () => {
            const before = box.scrollHeight;
            state.renderLimit += 80;
            renderThread('none');
            box.scrollTop = box.scrollHeight - before;
        });
        frag.appendChild(more);
    }

    const file = contactFor(th.name).file;
    let lastDay = null;
    items.forEach((it, i) => {
        if (it.ts && it.ts.toDateString() !== lastDay) {
            lastDay = it.ts.toDateString();
            frag.appendChild(el('div', 'pcu-day', fmtDay(it.ts)));
        }
        if (it.kind === 'call') {
            const line = el('div', `pcu-callline ${it.call.status === 'answered' ? '' : 'pcu-missed'}`);
            line.appendChild(el('i', `fa-solid ${it.call.status === 'answered' ? 'fa-phone' : 'fa-phone-slash'}`));
            line.appendChild(el('span', null, ` ${callLabel(it.call)} · ${fmtClock(it.ts)}`));
            frag.appendChild(line);
            return;
        }
        const next = items[i + 1];
        const nextSame = !!next && next.kind === 'msg' && next.who === it.who && (!it.ts || !next.ts || next.ts - it.ts < 5 * 60000);

        const row = el('div', `pcu-row ${it.who}`);
        if (it.who === 'bot') {
            const av = el('div', `pcu-av pcu-av-xs${nextSame ? ' pcu-ghost' : ''}`);
            if (!nextSame) setAvatar(av, th.name, file);
            row.appendChild(av);
        }
        const col = el('div', 'pcu-col');
        const line = el('div', 'pcu-line');
        const bubble = el('div', 'pcu-bubble');
        if (it.quote) {
            const quote = el('div', 'pcu-quote');
            quote.appendChild(el('span', null, it.quote));
            bubble.appendChild(quote);
            const body = el('div');
            fillRich(body, it.text);
            bubble.appendChild(body);
        } else {
            fillRich(bubble, it.text);
        }

        const replyBtn = el('button', 'pcu-reply-btn');
        replyBtn.type = 'button';
        replyBtn.title = t('reply');
        replyBtn.appendChild(el('i', 'fa-solid fa-reply'));
        replyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setReply(it.who === 'user' ? t('you') : th.name, it.text);
        });
        bubble.addEventListener('click', () => row.classList.toggle('pcu-tap'));

        line.appendChild(bubble);
        line.appendChild(replyBtn);
        col.appendChild(line);
        if (!nextSame && it.ts) col.appendChild(el('div', 'pcu-time', fmtClock(it.ts)));
        row.appendChild(col);
        frag.appendChild(row);
    });

    if (state.generating && state.awaiting === th.id) {
        const row = el('div', 'pcu-row bot');
        const av = el('div', 'pcu-av pcu-av-xs');
        setAvatar(av, th.name, file);
        row.appendChild(av);
        const bubble = el('div', 'pcu-bubble pcu-typing');
        for (let k = 0; k < 3; k++) bubble.appendChild(el('span', 'pcu-dot'));
        row.appendChild(bubble);
        frag.appendChild(row);
    }

    box.textContent = '';
    box.appendChild(frag);
    if (stick) box.scrollTop = box.scrollHeight;
    updateThreadHeader(th);
    markThreadRead(th);
}

/* ------------------------------------------------------------------ */
/* sending: what is typed on the phone goes into the story chat        */
/* ------------------------------------------------------------------ */
function setReply(name, text) {
    const snippet = noAsterisks(text).slice(0, 70);
    state.replyTo = { name, snippet };
    $id('pcu_reply_name').textContent = t('replyingTo', name);
    $id('pcu_reply_snip').textContent = snippet;
    $id('pcu_replybar').hidden = false;
    $id('pcu_input').focus();
}
function clearReply() {
    state.replyTo = null;
    const bar = $id('pcu_replybar');
    if (bar) bar.hidden = true;
}

// our "generating" flag comes from events; if an end event was ever missed, ST's own stop button tells the truth
function generationLooksStuck() {
    if (Date.now() - state.genAt < 4000) return false;
    const stop = document.getElementById('mes_stop');
    return !!stop && getComputedStyle(stop).display === 'none';
}

function sendFromPhone() {
    const th = currentThread();
    const input = $id('pcu_input');
    const text = input.value.trim();
    if (!th || !text) return;
    if (state.generating && generationLooksStuck()) onGenerationEnded(); // never lock the phone's send button forever
    if (state.generating) {
        toast(t('busy'), 'warning');
        return;
    }
    const ta = document.getElementById('send_textarea');
    const btn = document.getElementById('send_but');
    if (!ta || !btn) {
        toast(t('noSendBox'), 'error');
        return;
    }
    const quote = state.replyTo?.snippet ?? null;
    const line = formatUserLine({ app: th.app, name: th.name, text, quote });

    const previous = ta.value; // don't lose what the user was typing in ST's own box
    ta.value = line;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    btn.click();
    if (previous) setTimeout(() => { if (!ta.value) ta.value = previous; }, 150);

    state.pending.push({ tid: th.id, text, quote, at: Date.now() });
    state.awaiting = th.id;
    input.value = '';
    autoGrow(input);
    clearReply();
    renderThread('bottom');
}

function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 110)}px`;
}

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */
let notifTimer = null;
function ping() {
    if (!S().sound) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ac = (ping.ac ??= new AC());
        const o = ac.createOscillator();
        const g = ac.createGain();
        const t0 = ac.currentTime;
        o.type = 'sine';
        o.frequency.setValueAtTime(880, t0);
        o.frequency.setValueAtTime(1175, t0 + 0.09);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        o.connect(g).connect(ac.destination);
        o.start(t0);
        o.stop(t0 + 0.32);
    } catch { /* audio blocked until first user gesture: ignore */ }
}

function showNotification({ name, text, file = null, app = '', route = null }) {
    const n = $id('pcu_notif');
    if (!n) return;
    setAvatar($id('pcu_n_av'), name, file);
    $id('pcu_n_name').textContent = app ? `${name} · ${app}` : name;
    $id('pcu_n_time').textContent = fmtClock(new Date());
    $id('pcu_n_text').textContent = text;
    state.notifRoute = route;
    n.classList.add('pcu-show');
    ping();
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => n.classList.remove('pcu-show'), 4800);
}
const hideNotification = () => $id('pcu_notif')?.classList.remove('pcu-show');

/* ------------------------------------------------------------------ */
/* calls app                                                           */
/* ------------------------------------------------------------------ */
function renderCalls() {
    const list = $id('pcu_calls_list');
    if (!list) return;
    const m = meta();
    m.calls.forEach((c) => { c.seen = true; });
    list.textContent = '';
    const cardName = headerInfo().name;

    list.appendChild(el('div', 'pcu-section', t('recent')));
    const calls = [...m.calls].sort((a, b) => b.startMs - a.startMs).slice(0, 40);
    if (!calls.length) list.appendChild(el('div', 'pcu-empty', t('noCalls')));
    calls.forEach((cl) => {
        const name = cl.name ?? cardName;
        const missed = cl.status !== 'answered';
        const sub = el('div', `pcu-li-sub${missed ? ' pcu-missed-text' : ''}`);
        sub.textContent = `${cl.direction === 'out' ? '↗' : '↙'} ${callLabel(cl)}`;
        const row = listRow({
            name,
            file: contactFor(name).file,
            title: nameWithApp(name, ''),
            sub,
            right: el('span', 'pcu-li-time', fmtWhenShort(new Date(cl.startMs))),
            badge: null,
            onClick: () => startCall('out', contactFor(name)),
        });
        list.appendChild(row);
    });

    list.appendChild(el('div', 'pcu-section', t('contacts')));
    knownContacts().forEach((name) => {
        const icon = el('span', 'pcu-li-call');
        icon.appendChild(el('i', 'fa-solid fa-phone'));
        list.appendChild(listRow({
            name,
            file: contactFor(name).file,
            title: nameWithApp(name, ''),
            sub: null,
            right: icon,
            badge: null,
            onClick: () => startCall('out', contactFor(name)),
        }));
    });
    persistSoon();
}

function pushCallLine(call, who, text) {
    if (who !== 'sys') call.transcript.push({ who, text });
    const log = $id('pcu_call_log');
    if (!log) return;
    log.appendChild(el('div', `pcu-cl pcu-cl-${who}`, text));
    log.scrollTop = log.scrollHeight;
}

function setCallBusy(call, busy) {
    call.busy = busy;
    const input = $id('pcu_call_input');
    input.disabled = busy || !call.connectedMs;
    $id('pcu_call_send').disabled = input.disabled;
    $id('pcu_call_status').textContent = !call.connectedMs
        ? (call.direction === 'out' ? t('calling') : t('connecting'))
        : `${fmtDuration(Math.round((Date.now() - call.connectedMs) / 1000))} · ${busy ? t('speaking') : t('onCall')}`;
    if (!busy && call.connectedMs) input.focus();
}

function callPrompt(call, opening) {
    const bot = call.contact.name;
    const me = userName();
    const first = !opening ? '' : call.direction === 'out'
        ? ` ${me} just called you and you picked up: say hello.`
        : ` You called ${me} and they just picked up: speak first.`;
    const lines = call.transcript.map((l) => `${l.who === 'user' ? me : bot}: ${l.text}`).join('\n');
    return `[A live voice phone call is in progress between you (${bot}) and ${me}. Reply ONLY with what ${bot} says out loud next, in character: 1-3 short sentences, no narration, no asterisks, no stage directions, no tags.${first}]${lines ? `\n${lines}` : ''}`;
}

function callText(reply) {
    const s = plainText(reply);
    const spoken = s.replace(/\*[^*\n]*\*/g, ' ').replace(/\s+/g, ' ').trim();
    return spoken || noAsterisks(s);
}

async function botSpeak(call, opening = false) {
    if (state.call !== call) return;
    setCallBusy(call, true);
    try {
        const reply = await ctx().generateQuietPrompt({ quietPrompt: callPrompt(call, opening) });
        if (state.call !== call) return;
        const text = callText(String(reply ?? ''));
        pushCallLine(call, 'bot', text || '…');
    } catch (err) {
        console.error(TAG, 'call generation failed', err);
        if (state.call === call) pushCallLine(call, 'sys', t('callGlitch'));
    } finally {
        if (state.call === call) setCallBusy(call, false);
    }
}

function startCall(direction = 'out', contact = null) {
    if (state.call || state.ringing) return;
    if (!state.open) openPhone();
    const info = contact ?? headerInfo();
    const call = { id: uid(), direction, contact: { name: info.name, file: info.file ?? null }, startMs: Date.now(), connectedMs: null, transcript: [], busy: false, ringTimer: null, timer: null };
    state.call = call;

    setAvatar($id('pcu_call_av'), info.name, info.file);
    $id('pcu_call_name').textContent = info.name;
    $id('pcu_call_log').textContent = '';
    $id('pcu_call_input').value = '';
    $id('pcu_call').hidden = false;
    setCallBusy(call, true);

    call.ringTimer = setTimeout(() => {
        if (state.call !== call) return;
        call.connectedMs = Date.now();
        call.timer = setInterval(() => { if (state.call === call) setCallBusy(call, call.busy); }, 1000);
        botSpeak(call, true);
    }, direction === 'out' ? 1600 + Math.random() * 1400 : 900);
}

function endCall() {
    const call = state.call;
    if (!call) return;
    clearTimeout(call.ringTimer);
    clearInterval(call.timer);
    state.call = null;
    const answered = !!call.connectedMs;
    meta().calls.push({
        id: call.id,
        direction: call.direction,
        name: call.contact.name,
        startMs: call.startMs,
        durationSec: answered ? Math.round((Date.now() - call.connectedMs) / 1000) : 0,
        status: answered ? 'answered' : 'cancelled',
        transcript: call.transcript.slice(-40),
        seen: true,
    });
    persist();
    $id('pcu_call').hidden = true;
    refreshScreen('bottom');
}

// chat switched mid-call: drop it silently instead of saving it into the wrong chat
function abortCallAndRing() {
    if (state.call) {
        clearTimeout(state.call.ringTimer);
        clearInterval(state.call.timer);
        state.call = null;
        $id('pcu_call').hidden = true;
    }
    if (state.ringing) {
        clearTimeout(state.ringing.timeout);
        clearInterval(state.ringing.tick);
        state.ringing = null;
        $id('pcu_ring').hidden = true;
    }
}

function sendCallLine() {
    const call = state.call;
    const input = $id('pcu_call_input');
    const text = input.value.trim();
    if (!call || !call.connectedMs || call.busy || !text) return;
    input.value = '';
    pushCallLine(call, 'user', text);
    botSpeak(call, false);
}

// someone calls the user
function incomingCall(name = '') {
    if (state.call || state.ringing) return;
    buildSkeleton();
    if (!state.open) openPhone();
    const contact = name ? contactFor(name) : { ...headerInfo() };
    setAvatar($id('pcu_ring_av'), contact.name, contact.file);
    $id('pcu_ring_name').textContent = contact.name;
    $id('pcu_ring_status').textContent = t('incoming');
    $id('pcu_ring').hidden = false;
    const ring = { startMs: Date.now(), contact, timeout: null, tick: null };
    ring.timeout = setTimeout(() => resolveRing('missed'), 30000);
    if (S().sound) ring.tick = setInterval(ping, 2200);
    ping();
    state.ringing = ring;
}

function resolveRing(result) {
    const ring = state.ringing;
    if (!ring) return;
    clearTimeout(ring.timeout);
    clearInterval(ring.tick);
    state.ringing = null;
    $id('pcu_ring').hidden = true;
    if (result === 'accepted') {
        startCall('in', ring.contact);
        return;
    }
    meta().calls.push({ id: uid(), direction: 'in', name: ring.contact.name, startMs: ring.startMs, durationSec: 0, status: result, transcript: [], seen: state.open && state.screen === 'calls' });
    persist();
    refreshScreen('bottom');
}

/* ------------------------------------------------------------------ */
/* social app                                                          */
/* ------------------------------------------------------------------ */
function renderSocial() {
    const feed = $id('pcu_feed');
    if (!feed) return;
    const m = meta();
    const posts = model().posts;
    feed.textContent = '';
    if (!posts.length) feed.appendChild(el('div', 'pcu-empty', t('noPosts')));
    posts.forEach((p) => {
        const card = el('div', 'pcu-post');
        const head = el('div', 'pcu-post-head');
        const av = el('div', 'pcu-av pcu-av-md');
        setAvatar(av, p.author, contactFor(p.author).file);
        head.appendChild(av);
        const who = el('div', 'pcu-post-who');
        who.appendChild(nameWithApp(p.author, p.app));
        if (p.ts != null) who.appendChild(el('div', 'pcu-li-time', `${fmtDay(new Date(p.ts))} ${fmtClock(new Date(p.ts))}`));
        head.appendChild(who);
        card.appendChild(head);
        const body = el('div', 'pcu-post-text');
        fillRich(body, p.text);
        card.appendChild(body);
        const like = el('button', `pcu-like${m.likes[p.key] ? ' pcu-liked' : ''}`);
        like.type = 'button';
        like.setAttribute('aria-label', t('like'));
        like.appendChild(el('i', `${m.likes[p.key] ? 'fa-solid' : 'fa-regular'} fa-heart`));
        like.addEventListener('click', () => {
            m.likes[p.key] = !m.likes[p.key];
            persistSoon();
            renderSocial();
        });
        card.appendChild(like);
        feed.appendChild(card);
    });
    const newest = posts[0]?.idx ?? -1;
    if (newest > (m.readPosts ?? -1)) {
        m.readPosts = newest;
        persistSoon();
    }
}

/* ------------------------------------------------------------------ */
/* calendar                                                            */
/* ------------------------------------------------------------------ */
async function addEvent(title, when, by = 'bot') {
    const m = meta();
    const whenISO = when.toISOString();
    const clean = String(title).trim().slice(0, 120);
    if (!clean) return false;
    if (m.events.some((e) => e.whenISO === whenISO && e.title.toLowerCase() === clean.toLowerCase())) return false;
    const lead = when.getTime() - Date.now();
    m.events.push({ id: uid(), title: clean, whenISO, by, notifiedPre: lead < 15 * 60000, notified: lead < 0 });
    await persist();
    return true;
}

function openCalendarScreen() {
    if (!state.calMonth) {
        state.calMonth = startOfMonth(new Date());
        state.calSel = startOfDay(new Date());
        const d = new Date(state.calSel);
        d.setHours(9, 0, 0, 0);
        $id('pcu_cal_when').value = inputLocal(d);
    }
    renderCalendar();
}

function renderCalendar() {
    const base = state.calMonth;
    const sel = state.calSel;
    if (!base || !sel) return;
    const events = meta().events;
    $id('pcu_cal_head').textContent = base.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });

    const byDay = new Map();
    events.forEach((ev) => {
        const k = new Date(ev.whenISO).toDateString();
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(ev);
    });

    const grid = $id('pcu_cal_grid');
    grid.textContent = '';
    t('weekdays').forEach((w) => grid.appendChild(el('div', 'pcu-wd', w)));
    const lead = new Date(base.getFullYear(), base.getMonth(), 1).getDay();
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    for (let i = 0; i < lead; i++) grid.appendChild(el('div', 'pcu-cell pcu-empty'));
    const today = new Date();
    for (let d = 1; d <= days; d++) {
        const date = new Date(base.getFullYear(), base.getMonth(), d);
        const cell = el('button', 'pcu-cell', String(d));
        cell.type = 'button';
        if (sameDay(date, today)) cell.classList.add('pcu-today');
        if (sameDay(date, sel)) cell.classList.add('pcu-sel');
        if (byDay.has(date.toDateString())) cell.classList.add('pcu-has');
        cell.addEventListener('click', () => {
            state.calSel = date;
            const w = new Date(date);
            w.setHours(9, 0, 0, 0);
            $id('pcu_cal_when').value = inputLocal(w);
            renderCalendar();
        });
        grid.appendChild(cell);
    }

    const list = $id('pcu_cal_list');
    list.textContent = '';
    const dayEvents = (byDay.get(sel.toDateString()) ?? []).sort((a, b) => new Date(a.whenISO) - new Date(b.whenISO));
    list.appendChild(el('div', 'pcu-cal-day', fmtDay(sel)));
    if (!dayEvents.length) list.appendChild(el('div', 'pcu-cal-empty', t('noEventsDay')));
    dayEvents.forEach((ev) => {
        const when = new Date(ev.whenISO);
        const row = el('div', `pcu-ev${when < new Date() ? ' pcu-past' : ''}`);
        row.appendChild(el('div', 'pcu-ev-time', fmtClock(when)));
        const body = el('div', 'pcu-ev-body');
        body.appendChild(el('div', 'pcu-ev-title', ev.title));
        body.appendChild(el('div', 'pcu-ev-by', ev.by === 'bot' ? t('byBot') : t('byUser')));
        row.appendChild(body);
        const del = el('button', 'pcu-icon');
        del.type = 'button';
        del.appendChild(el('i', 'fa-solid fa-xmark'));
        del.addEventListener('click', async () => {
            const m = meta();
            m.events = m.events.filter((e) => e.id !== ev.id);
            await persist();
            renderCalendar();
        });
        row.appendChild(del);
        list.appendChild(row);
    });
}

async function addEventFromForm() {
    const title = $id('pcu_cal_title').value.trim();
    const when = new Date($id('pcu_cal_when').value);
    if (!title || Number.isNaN(when.getTime())) return;
    await addEvent(title, when, 'user');
    $id('pcu_cal_title').value = '';
    state.calSel = startOfDay(when);
    state.calMonth = startOfMonth(when);
    renderCalendar();
}

// reminders: 15 minutes before and at the time, for the CURRENT chat's calendar
let reminderTimer = null;
function checkReminders() {
    const s = S();
    if (!s.reminders) return;
    const m = meta();
    const now = Date.now();
    const info = headerInfo();
    const route = { screen: 'calendar' };
    let changed = false;
    m.events.forEach((ev) => {
        const at = new Date(ev.whenISO).getTime();
        if (!ev.notifiedPre && now >= at - 15 * 60000 && now < at) {
            ev.notifiedPre = true;
            changed = true;
            showNotification({ name: info.name, file: info.file, route, text: `⏰ ${t('remindPre', ev.title, Math.max(1, Math.round((at - now) / 60000)))}` });
        }
        if (!ev.notified && now >= at) {
            ev.notified = true;
            changed = true;
            if (now < at + 30 * 60000) showNotification({ name: info.name, file: info.file, route, text: `⏰ ${t('remindNow', ev.title)}` });
        }
    });
    if (changed) persist();
}

/* ------------------------------------------------------------------ */
/* making the bot aware: how the phone works, time, calendar, calls    */
/* ------------------------------------------------------------------ */
function upcomingEvents(now) {
    return meta().events
        .map((e) => ({ ...e, at: new Date(e.whenISO) }))
        .filter((e) => e.at > new Date(now.getTime() - 2 * 3600000) && e.at < new Date(now.getTime() + 48 * 3600000))
        .sort((a, b) => a.at - b.at)
        .slice(0, 6);
}

function recentCalls(now) {
    return meta().calls.filter((c) => c.startMs > now.getTime() - 6 * 3600000).sort((a, b) => a.startMs - b.startMs).slice(-3);
}

function buildContextNote() {
    const now = new Date();
    const me = userName();
    const cardName = headerInfo().name;
    const out = [`[Phone system note (not part of ${me}'s message): in this story ${me} has a smartphone.`];
    out.push(`Real-world clock, for reference only (follow the story's own timeline if it has one): ${now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${isoLocal(now)}).`);
    out.push(`Whenever your reply has someone send ${me} a phone message, ${me} send one, a social post show up, or the phone ring: do NOT write the message text inside the narration. Put it in a hidden tag on its own line after the narration and only narrate the reaction (the buzz, the glance at the screen):`);
    out.push('[[msg: Sender || App || message text]] - incoming message (App such as LINE, Messenger, SMS, IG)');
    out.push(`[[sent: Recipient || App || message text]] - message ${me} sent`);
    out.push(`[[post: Author || App || post text]] - social media post ${me} sees`);
    out.push('[[call: Caller]] - incoming call (narrate only that the phone rings)');
    out.push('[[calendar: Title || YYYY-MM-DD HH:mm]] - appointment that was agreed');
    out.push(`Texts are short, in the sender's own voice and in the story's own language, with no quotation marks. A line of ${me}'s message that starts with 📱 [App › Name] is a text ${me} just sent from the phone to that contact: react to it in the story, and if Name would reply, answer with a [[msg: Name || App || ...]] tag.`);

    const evs = upcomingEvents(now);
    if (evs.length) {
        out.push('Shared calendar (upcoming appointments):');
        evs.forEach((e) => out.push(`- ${EN_WEEKDAYS[e.at.getDay()]} ${isoLocal(e.at)} ${e.title}`));
    }

    const calls = recentCalls(now);
    if (calls.length) {
        out.push('Recent phone calls:');
        calls.forEach((c) => {
            const who = c.name ?? cardName;
            const at = isoLocal(new Date(c.startMs)).slice(11);
            const dur = fmtDuration(c.durationSec || 0);
            let desc;
            if (c.direction === 'out') desc = c.status === 'answered' ? `${me} called ${who} and they talked for ${dur}.` : `${me} tried to call ${who} but hung up before they answered.`;
            else if (c.status === 'answered') desc = `${who} called ${me}, they picked up (${dur}).`;
            else desc = c.status === 'declined' ? `${who} called ${me} but they declined.` : `${who} called ${me} but they did not pick up.`;
            out.push(`- ${at} ${desc}`);
            (c.transcript || []).slice(-8).forEach((l) => out.push(`    ${l.who === 'user' ? me : who}: ${String(l.text).slice(0, 160)}`));
        });
    }
    out.push(']');
    return out.join('\n').slice(0, 3200);
}

// referenced by "generate_interceptor" in manifest.json
globalThis.pcuInterceptor = async function pcuInterceptor(chat, _contextSize, _abort, type) {
    try {
        if (!S().injectContext || type === 'quiet' || type === 'impersonate' || !chat?.length) return;
        const note = buildContextNote();
        const last = chat[chat.length - 1];
        if (last?.is_user) {
            // ephemeral: a copy of the last user message with the note appended (the real message is untouched)
            chat[chat.length - 1] = { ...structuredClone(last), mes: `${last.mes ?? ''}\n\n${note}` };
        } else {
            chat.splice(chat.length - 1, 0, { is_user: false, is_system: false, name: 'Phone', send_date: Date.now(), mes: note });
        }
    } catch (err) {
        console.error(TAG, 'interceptor failed', err);
    }
};

/* ------------------------------------------------------------------ */
/* reacting to the story                                               */
/* ------------------------------------------------------------------ */
function remember(key) {
    if (state.notified.has(key)) return false;
    if (state.notified.size > 600) state.notified.clear();
    state.notified.add(key);
    return true;
}

// show the pop-up: open the phone right away (autoOpen) or drop a banner from the top
function deliver(note) {
    if (S().autoOpen && !state.open && !state.call && !state.ringing) {
        openRoute(note.route);
        return;
    }
    if (S().notifications) showNotification(note);
}

// a new phone item appeared (from a tag or from the AI fallback): banner / ring
function announce(f, key) {
    if (!remember(key)) return;
    if (f.t === 'call') {
        incomingCall(f.name);
        return;
    }
    if (f.app && hiddenApps().has(canonApp(f.app).toLowerCase())) return;
    const contact = contactFor(f.name);
    if (f.t === 'post') {
        deliver({ name: f.name, app: f.app, file: contact.file, text: t('notifPost', f.name), route: { screen: 'social' } });
        return;
    }
    const th = resolveThread(f.name, f.app);
    if (state.open && state.screen === 'thread' && state.threadId === th.id) return; // already looking at it
    const mine = f.t === 'sent';
    deliver({
        name: th.name,
        app: th.app,
        file: contact.file,
        text: `${mine ? `${t('you')}: ` : ''}${f.text.slice(0, 90)}`,
        route: { screen: 'thread', thread: th.id, name: th.name, app: th.app },
    });
}

// a quiet request must not collide with the story being written: wait until SillyTavern is idle
async function waitIdle(maxMs = 30000) {
    const t0 = Date.now();
    while (state.generating && Date.now() - t0 < maxMs) {
        if (generationLooksStuck()) onGenerationEnded();
        else await new Promise((r) => setTimeout(r, 300));
    }
    return !state.generating;
}

async function onMessageReceived(mesId) {
    const c = ctx();
    const msg = c.chat?.[Number.isInteger(mesId) ? mesId : c.chat.length - 1];
    markDirty();
    if (!msg || msg.is_user || msg.is_system) return;
    const raw = String(msg.mes ?? '');
    const sig = hash(raw);
    const tags = parseTags(raw);
    let phoneHit = false;

    for (const tag of tags) {
        const key = `${sig}#${tag.k}`;
        if (tag.type === 'calendar') {
            const when = parseWhen(tag.whenRaw);
            if (when && await addEvent(tag.title, when, 'bot')) {
                toast(`📅 ${t('apptAdded', tag.title.trim())}`, 'success');
            }
        } else {
            phoneHit = true;
            announce({ t: tag.type, name: tag.name, app: tag.app, text: tag.text ?? '' }, key);
        }
    }
    scheduleRefresh();

    if (!phoneHit && S().autoDetect && looksPhoneRelated(plainText(raw))) {
        detectPhoneEvents(msg, sig).catch((err) => console.error(TAG, 'phone check failed', err));
    }
}

// the story mentioned a phone but wrote no tag: ask the AI what happened on the phone
async function detectPhoneEvents(msg, sig) {
    if (state.detecting || Date.now() - state.lastDetectAt < 15000) return;
    state.detecting = true;
    state.lastDetectAt = Date.now();
    try {
        if (!(await waitIdle())) return;
        const me = userName();
        const prompt = `[Phone check — do not continue the story. Read the most recent passage above. If it clearly shows someone sending ${me} a phone message, ${me} sending one, someone calling ${me}, or a social media post ${me} sees, output ONLY a JSON array such as [{"t":"msg","from":"Name","app":"LINE","text":"the message exactly as the sender typed it"}]. t is one of: msg (incoming message, use "from"), sent (${me} sends it, use "to"), call (use "from"), post (use "from" for the author). Message texts are short and in the sender's own voice. If nothing like that happens, output [].]`;
        const reply = await ctx().generateQuietPrompt({ quietPrompt: prompt });
        const events = parseExtraction(reply);
        if (!events.length) return;
        // the message may have been swiped/edited while we were waiting
        const chat = ctx().chat ?? [];
        if (!chat.some((m) => m && !m.is_user && hash(String(m.mes ?? '')) === sig)) return;
        const m = meta();
        events.forEach((e, j) => {
            if (e.t !== 'call') m.extracted.push({ sig, t: e.t, name: e.name, app: e.app, text: e.text });
            announce({ t: e.t, name: e.name, app: e.app, text: e.text }, `${sig}#x${j}`);
        });
        if (m.extracted.length > 200) m.extracted.splice(0, m.extracted.length - 200);
        markDirty();
        persistSoon();
        scheduleRefresh();
    } finally {
        state.detecting = false;
    }
}

function onGenerationStarted(type, _params, dryRun) {
    if (dryRun || type === 'quiet' || type === 'impersonate') return;
    state.generating = true;
    state.genAt = Date.now();
    scheduleRefresh();
}
function onGenerationEnded() {
    if (!state.generating) return;
    state.generating = false;
    state.awaiting = null;
    scheduleRefresh();
}
function onChatChanged() {
    state.generating = false;
    state.awaiting = null;
    state.pending = [];
    state.virtual = null;
    state.threadId = null;
    state.appFilter = null;
    state.renderLimit = 80;
    state.calMonth = null;
    clearReply();
    abortCallAndRing();
    markDirty();
    ensureBaseline();
    if (state.open) {
        if (state.screen === 'thread') state.screen = 'chat';
        go(state.screen);
    }
    updateFab();
    scheduleDecorateAll();
}

function registerEvents() {
    const { eventSource, event_types: E } = ctx();
    const on = (name, fn) => { if (E[name]) eventSource.on(E[name], fn); };
    const dirty = () => { markDirty(); scheduleRefresh(); };
    on('MESSAGE_RECEIVED', onMessageReceived);
    on('CHARACTER_MESSAGE_RENDERED', dirty);
    on('USER_MESSAGE_RENDERED', () => { state.pending = []; markDirty(); scheduleRefresh('bottom'); });
    on('MESSAGE_SWIPED', dirty);
    on('MESSAGE_DELETED', dirty);
    on('MESSAGE_EDITED', dirty);
    on('GENERATION_STARTED', onGenerationStarted);
    on('GENERATION_ENDED', onGenerationEnded);
    on('GENERATION_STOPPED', onGenerationEnded);
    on('CHAT_CHANGED', onChatChanged);
}

/* ------------------------------------------------------------------ */
/* the main chat: tags become small chips that open the phone          */
/* ------------------------------------------------------------------ */
function chipHtml(tag) {
    let label;
    let route;
    switch (tag.type) {
        case 'msg': label = t('chipMsg', tag.name); route = 'thread'; break;
        case 'sent': label = t('chipSent', tag.name); route = 'thread'; break;
        case 'post': label = t('chipPost', tag.name); route = 'social'; break;
        case 'call': label = t('chipCall', tag.name); route = 'calls'; break;
        case 'calendar': label = t('chipCal', tag.title); route = 'calendar'; break;
        default: return '';
    }
    const data = `data-route="${route}" data-name="${esc(tag.name ?? '')}" data-app="${esc(tag.app ?? '')}"`;
    return `<span class="pcu-chip" role="button" tabindex="0" ${data}>📱 ${esc(label)}</span>`;
}

const inertText = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

function decorateMes(node) {
    if (!node?.isConnected) return;
    const html = node.innerHTML;
    if (!html.includes('[[')) return;
    const next = html.replace(TAG_HTML_RE, (full) => {
        const tag = parseOneTag(inertText(full));
        return tag ? chipHtml(tag) : '';
    });
    if (next !== html) node.innerHTML = next;
}

let chatObserver = null;
let decoTimer = 0;
const decoQueue = new Set();
function flushDecorate() {
    decoTimer = 0;
    const nodes = [...decoQueue];
    decoQueue.clear();
    if (S().hideTags) nodes.forEach(decorateMes);
}
function queueDecorate(node) {
    decoQueue.add(node);
    if (!decoTimer) decoTimer = setTimeout(flushDecorate, 120);
}
function scheduleDecorateAll() {
    document.querySelectorAll('#chat .mes_text').forEach(queueDecorate);
}

function startChatObserver() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return false;
    if (chatObserver) return true;
    chatObserver = new MutationObserver((muts) => {
        if (!S().hideTags) return;
        for (const mu of muts) {
            mu.addedNodes.forEach((n) => {
                if (n.nodeType !== 1) return;
                if (n.matches?.('.mes_text')) queueDecorate(n);
                n.querySelectorAll?.('.mes_text').forEach(queueDecorate);
            });
            const base = mu.target.nodeType === 1 ? mu.target : mu.target.parentElement;
            const mt = base?.closest?.('.mes_text');
            if (mt) queueDecorate(mt);
        }
    });
    chatObserver.observe(chatEl, { childList: true, subtree: true, characterData: true });
    scheduleDecorateAll();
    return true;
}

function onChipActivate(chip) {
    const route = chip.dataset.route;
    const name = chip.dataset.name;
    if (route === 'thread' && name) openThread(name, chip.dataset.app);
    else openPhone({ screen: route });
}

/* ------------------------------------------------------------------ */
/* DOM event wiring                                                    */
/* ------------------------------------------------------------------ */
function wireHandlers() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    $id('pcu_phone').addEventListener('click', (e) => {
        const b = e.target.closest?.('[data-act],[data-open],[data-app]');
        if (!b) return;
        if (b.dataset.app) { state.appFilter = b.dataset.app; go('chat'); return; }
        if (b.dataset.open) { go(b.dataset.open); return; }
        switch (b.dataset.act) {
            case 'back': goBack(); break;
            case 'close': closePhone(); break;
            case 'new-chat': go('new'); break;
            case 'call-thread': { const th = currentThread(); if (th) startCall('out', contactFor(th.name)); break; }
            default: break;
        }
    });
    $id('pcu_fab').addEventListener('click', openFromFab);
    $id('pcu_send').addEventListener('click', sendFromPhone);
    $id('pcu_reply_x').addEventListener('click', clearReply);
    $id('pcu_new_go').addEventListener('click', startNewChat);
    $id('pcu_new_name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) startNewChat(); });

    const input = $id('pcu_input');
    input.addEventListener('input', () => autoGrow(input));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.isComposing) {
            e.preventDefault();
            sendFromPhone();
        }
    });

    $id('pcu_cal_prev').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderCalendar(); });
    $id('pcu_cal_next').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderCalendar(); });
    $id('pcu_cal_add').addEventListener('click', addEventFromForm);
    $id('pcu_cal_title').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addEventFromForm(); });

    $id('pcu_call_end').addEventListener('click', endCall);
    $id('pcu_call_send').addEventListener('click', sendCallLine);
    $id('pcu_call_input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) sendCallLine(); });

    $id('pcu_ring_yes').addEventListener('click', () => resolveRing('accepted'));
    $id('pcu_ring_no').addEventListener('click', () => resolveRing('declined'));

    $id('pcu_notif').addEventListener('click', () => {
        const route = state.notifRoute;
        hideNotification();
        openRoute(route);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.open && !state.call && !state.ringing) goBack();
    });
    document.addEventListener('click', (e) => {
        const chip = e.target.closest?.('.pcu-chip');
        if (chip) onChipActivate(chip);
    });
    document.addEventListener('keydown', (e) => {
        const chip = e.target.closest?.('.pcu-chip');
        if (chip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChipActivate(chip); }
    });
    window.visualViewport?.addEventListener('resize', fitViewport);
    window.visualViewport?.addEventListener('scroll', fitViewport);
}

/* ------------------------------------------------------------------ */
/* settings panel + wand-menu button                                   */
/* ------------------------------------------------------------------ */
function applyAccent() {
    document.documentElement.style.setProperty('--pcu-accent', S().accent);
}

function buildSettingsPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || $id('pcu_settings')) return !!$id('pcu_settings');
    const s = S();
    const box = el('div');
    box.id = 'pcu_settings';
    box.innerHTML = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Phone Chat UI</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            ${[['notifications', 'setNotifications'], ['reminders', 'setReminders'], ['injectContext', 'setInject'], ['autoDetect', 'setDetect'], ['hideTags', 'setChips'], ['autoOpen', 'setAutoOpen'], ['fab', 'setFab'], ['sound', 'setSound']]
                .map(([k, label]) => `<label class="checkbox_label"><input type="checkbox" data-k="${k}"${s[k] ? ' checked' : ''}><span>${t(label)}</span></label>`).join('')}
            <label class="pcu-set-col"><span>${t('setApps')}</span><input type="text" class="text_pole" data-k="apps" maxlength="120" value="${esc(s.apps)}"></label>
            <label class="pcu-set-col"><span>${t('setHidden')}</span><input type="text" class="text_pole" data-k="hiddenApps" maxlength="120" value="${esc(s.hiddenApps)}"></label>
            <label class="pcu-set-row"><span>${t('setAccent')}</span><input type="color" data-k="accent" value="${s.accent}"></label>
            <div class="pcu-set-row">
                <button class="menu_button" type="button" id="pcu_test_ring">${t('testIncoming')}</button>
                <button class="menu_button" type="button" id="pcu_test_notif">${t('testNotif')}</button>
            </div>
            <small class="pcu-set-hint">${t('hint')}</small>
        </div>
    </div>`;
    host.appendChild(box);

    box.querySelectorAll('input[data-k]').forEach((inp) => {
        inp.addEventListener('change', () => {
            S()[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value;
            if (inp.dataset.k === 'accent') applyAccent();
            if (inp.dataset.k === 'hideTags' && inp.checked) scheduleDecorateAll();
            if (inp.dataset.k === 'apps' || inp.dataset.k === 'hiddenApps') { markDirty(); refreshScreen(); updateFab(); }
            if (inp.dataset.k === 'fab') updateFab();
            saveSettings();
        });
    });
    $id('pcu_test_ring').addEventListener('click', () => incomingCall());
    $id('pcu_test_notif').addEventListener('click', () => {
        const info = headerInfo();
        showNotification({ name: info.name, file: info.file, text: t('testNotifText'), route: null });
    });
    return true;
}

function addMenuButton() {
    if ($id('pcu_toggle_button')) return true;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;
    const item = el('div', 'list-group-item flex-container flexGap5 interactable');
    item.id = 'pcu_toggle_button';
    item.tabIndex = 0;
    item.appendChild(el('div', 'fa-solid fa-mobile-screen-button extensionsMenuExtensionButton'));
    item.appendChild(el('span', null, t('menu')));
    const mb = el('b', 'pcu-menu-badge');
    mb.id = 'pcu_menu_badge';
    mb.hidden = true;
    item.appendChild(mb);
    item.addEventListener('click', togglePhone);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') togglePhone(); });
    menu.appendChild(item);
    return true;
}

// the menu / settings containers may not exist yet when we start
function retryUntilReady(fn, tries = 40) {
    if (fn() || tries <= 0) return;
    setTimeout(() => retryUntilReady(fn, tries - 1), 750);
}

/* ------------------------------------------------------------------ */
/* init                                                                */
/* ------------------------------------------------------------------ */
function boot() {
    if (state.booted) return;
    state.booted = true;
    S();
    applyAccent();
    buildSkeleton();
    registerEvents();
    ensureBaseline();
    retryUntilReady(() => { const ok = addMenuButton(); if (ok) updateFab(); return ok; });
    retryUntilReady(buildSettingsPanel);
    retryUntilReady(startChatObserver);
    reminderTimer = setInterval(checkReminders, 20000);
    console.log(TAG, 'loaded');
}

// small public API: handy for debugging from the browser console
globalThis.PhoneChatUI = {
    open: openPhone, close: closePhone, toggle: togglePhone, openThread, go, incomingCall, startCall, updateFab,
    parseWhen, parseTime, buildContextNote, checkReminders, model, onMessageReceived, detectPhoneEvents,
};

(function init() {
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.APP_READY, boot);
})();
