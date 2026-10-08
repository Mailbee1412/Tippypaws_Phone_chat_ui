// ===== Phone Chat UI — SillyTavern extension =====
// A phone-style overlay for the CURRENT chat: bubbles, reply, date/time,
// notifications, a calendar (the bot can add appointments) and a text "call".
//
// It mirrors the real chat and sends through SillyTavern's own send button,
// so swipes / edits / world info / presets keep working as usual.
// Everything is plain DOM (no jQuery needed) and idle when the phone is closed.

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
        today: 'วันนี้', yesterday: 'เมื่อวาน', online: 'ออนไลน์', typing: 'กำลังพิมพ์…',
        placeholder: 'พิมพ์ข้อความ…', replyingTo: (n) => `ตอบกลับ ${n}`, reply: 'ตอบกลับ',
        earlier: 'ดูข้อความก่อนหน้า', menu: 'หน้าจอโทรศัพท์',
        calendar: 'ปฏิทิน', weekdays: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
        noEventsDay: 'ไม่มีนัดหมายในวันนี้', eventPlaceholder: 'ชื่อนัดหมาย…', add: 'เพิ่ม',
        byBot: 'บอทนัด', byUser: 'คุณเพิ่ม',
        calling: 'กำลังโทร…', connecting: 'กำลังเชื่อมต่อ…', onCall: 'กำลังสนทนา', incoming: 'สายเรียกเข้า…',
        callPlaceholder: 'พูดอะไรสักอย่าง…', callGlitch: '(สัญญาณขัดข้อง ลองพูดอีกครั้ง)', speaking: 'กำลังพูด…',
        callOutDone: (d) => `โทรออก · ${d}`, callOutCancel: 'ยกเลิกการโทร',
        callInDone: (d) => `สายเรียกเข้า · ${d}`, callInDeclined: 'ปฏิเสธสาย', callInMissed: 'สายที่ไม่ได้รับ',
        remindPre: (title, m) => `อีก ${m} นาที: ${title}`, remindNow: (title) => `ถึงเวลานัดแล้ว: ${title}`,
        apptAdded: (title) => `เพิ่มนัดหมาย: ${title}`,
        busy: 'บอทกำลังตอบอยู่ รอสักครู่', noSendBox: 'หาช่องส่งข้อความของ SillyTavern ไม่เจอ',
        setNotifications: 'แจ้งเตือนข้อความใหม่ (ตอนปิดหน้าจอโทรศัพท์)',
        setReminders: 'เตือนนัดหมายในปฏิทิน',
        setInject: 'ให้บอทรู้เวลาปัจจุบัน / นัดหมาย / ประวัติการโทร (เฉพาะตอนเปิดโหมดโทรศัพท์)',
        setStyle: 'สั่งให้บอทตอบสั้นแบบข้อความแชท (เฉพาะตอนเปิดโหมดโทรศัพท์)',
        setSound: 'เสียงแจ้งเตือน', setAccent: 'สีธีม',
        testIncoming: 'ทดสอบสายเรียกเข้า', testNotif: 'ทดสอบแจ้งเตือน', testNotifText: 'นี่คือการแจ้งเตือนตัวอย่าง',
        hint: 'เปิดหน้าจอโทรศัพท์จากเมนูไม้กายสิทธิ์ (🪄) ข้างช่องพิมพ์ → "หน้าจอโทรศัพท์"',
    },
    en: {
        today: 'Today', yesterday: 'Yesterday', online: 'Online', typing: 'typing…',
        placeholder: 'Message…', replyingTo: (n) => `Replying to ${n}`, reply: 'Reply',
        earlier: 'Show earlier messages', menu: 'Phone View',
        calendar: 'Calendar', weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        noEventsDay: 'No appointments this day', eventPlaceholder: 'Appointment title…', add: 'Add',
        byBot: 'set by bot', byUser: 'added by you',
        calling: 'Calling…', connecting: 'Connecting…', onCall: 'On call', incoming: 'Incoming call…',
        callPlaceholder: 'Say something…', callGlitch: '(bad connection, try again)', speaking: 'speaking…',
        callOutDone: (d) => `Outgoing call · ${d}`, callOutCancel: 'Call cancelled',
        callInDone: (d) => `Incoming call · ${d}`, callInDeclined: 'Declined call', callInMissed: 'Missed call',
        remindPre: (title, m) => `In ${m} min: ${title}`, remindNow: (title) => `It's time: ${title}`,
        apptAdded: (title) => `Appointment added: ${title}`,
        busy: 'The bot is still replying, one moment', noSendBox: 'Could not find SillyTavern\'s send box',
        setNotifications: 'Notify on new messages (while the phone is closed)',
        setReminders: 'Calendar reminders',
        setInject: 'Tell the bot the current time / appointments / call history (phone mode only)',
        setStyle: 'Ask the bot to reply in short text-message style (phone mode only)',
        setSound: 'Notification sound', setAccent: 'Accent color',
        testIncoming: 'Test incoming call', testNotif: 'Test notification', testNotifText: 'This is a sample notification',
        hint: 'Open the phone from the wand (🪄) menu next to the input box → "Phone View"',
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

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
}

const fmtClock = (d) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: HOUR12 });
const fmtDateTime = (d) => d.toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: HOUR12 });
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const inputLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDuration = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

function fmtDay(d) {
    const now = new Date();
    if (sameDay(d, now)) return t('today');
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return t('yesterday');
    return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

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
    textStyle: true,
    sound: false,
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
function meta() {
    const md = ctx().chatMetadata;
    if (!md) return { events: [], calls: [] }; // no chat open: detached scratch object
    const m = (md[MODULE_NAME] ??= {});
    m.events ??= [];
    m.calls ??= [];
    return m;
}
const persist = () => ctx().saveMetadata?.();

/* ------------------------------------------------------------------ */
/* natural-language date/time parser (EN + TH)                         */
/* ------------------------------------------------------------------ */
const THAI_NUM = { 'สิบเอ็ด': 11, 'สิบสอง': 12, 'หนึ่ง': 1, 'นึง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9, 'สิบ': 10 };
const THAI_NUM_RE = new RegExp(Object.keys(THAI_NUM).join('|'), 'g');
const THAI_WEEKDAYS = [['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6]];
const EN_WEEKDAY_RE = /\b(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/;
const EN_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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
/* message text cleanup + hidden tags the bot may write                */
/* ------------------------------------------------------------------ */
const RE_TAG_CAL = /\[\[\s*calendar\s*:\s*([^\]]*?)\s*\|\|\s*([^\]]*?)\s*\]\]/gi;
const RE_TAG_CALL = /\[\[\s*call\b[^\]]*\]\]/i;
const RE_TAG_STRIP = /\[\[\s*(?:calendar|call)\b[^\]]*\]\]/gi;
const RE_QUOTE = /^↩ ([^:\n]{1,60}): "([^\n]*?)"\n([\s\S]*)$/;

function plainText(mes) {
    return String(mes ?? '')
        .replace(RE_TAG_STRIP, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\r/g, '')
        .trim();
}
const noAsterisks = (s) => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

// *action* -> <em>action</em>, everything else is inserted as plain text (XSS-safe)
function fillRich(node, text) {
    node.textContent = '';
    text.replace(/\*\*+/g, '*').split(/(\*[^*\n]+\*)/g).forEach((chunk) => {
        if (!chunk) return;
        if (/^\*[^*\n]+\*$/.test(chunk)) node.appendChild(el('em', null, chunk.slice(1, -1)));
        else node.appendChild(document.createTextNode(chunk));
    });
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
    return ctx().characters?.find((c) => c?.name === name) ?? null;
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

// initial letter first, swapped for the real picture once it has loaded
function setAvatar(node, name, file) {
    node.textContent = '';
    node.appendChild(el('span', null, (String(name || '?').trim().charAt(0) || '?').toUpperCase()));
    if (!file) return;
    const img = new Image();
    img.alt = '';
    img.onload = () => {
        node.textContent = '';
        node.appendChild(img);
    };
    img.src = avatarSrc(file);
}

/* ------------------------------------------------------------------ */
/* runtime state                                                       */
/* ------------------------------------------------------------------ */
const state = {
    open: false,
    generating: false,
    genAt: 0,
    genFrom: null,
    replyTo: null,
    renderLimit: 80,
    calMonth: null,
    calSel: null,
    call: null,
    ringing: null,
    clockTimer: null,
    booted: false,
};
const phoneMode = () => state.open || !!state.call || !!state.ringing;
const isPhoneOpen = () => state.open;

/* ------------------------------------------------------------------ */
/* DOM skeleton                                                        */
/* ------------------------------------------------------------------ */
function buildSkeleton() {
    if ($id('pcu_root')) return;

    const root = el('div');
    root.id = 'pcu_root';
    root.innerHTML = `
    <div class="pcu-phone" id="pcu_phone">
        <div class="pcu-status"><span id="pcu_clock"></span><span id="pcu_date"></span></div>
        <div class="pcu-header">
            <button class="pcu-icon" id="pcu_close" type="button" aria-label="Close"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="pcu-av pcu-av-md" id="pcu_h_av"></div>
            <div class="pcu-title"><div class="name" id="pcu_h_name"></div><div class="sub" id="pcu_h_sub"></div></div>
            <button class="pcu-icon" id="pcu_btn_cal" type="button" aria-label="Calendar"><i class="fa-solid fa-calendar-days"></i></button>
            <button class="pcu-icon" id="pcu_btn_call" type="button" aria-label="Call"><i class="fa-solid fa-phone"></i></button>
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

        <div class="pcu-overlay pcu-cal" id="pcu_cal" hidden>
            <div class="pcu-header">
                <button class="pcu-icon" id="pcu_cal_back" type="button" aria-label="Back"><i class="fa-solid fa-chevron-left"></i></button>
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
        </div>

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

    $id('pcu_input').placeholder = t('placeholder');
    $id('pcu_cal_title').placeholder = t('eventPlaceholder');
    $id('pcu_call_input').placeholder = t('callPlaceholder');
    $id('pcu_cal_head').textContent = t('calendar');
    wireHandlers();
}

/* ------------------------------------------------------------------ */
/* clock + header                                                      */
/* ------------------------------------------------------------------ */
function tickClock() {
    const now = new Date();
    const c = $id('pcu_clock');
    const d = $id('pcu_date');
    if (c) c.textContent = fmtClock(now);
    if (d) d.textContent = now.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
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

function updateHeader() {
    const info = headerInfo();
    const name = $id('pcu_h_name');
    if (!name) return;
    name.textContent = info.name;
    const sub = $id('pcu_h_sub');
    sub.textContent = state.generating ? t('typing') : t('online');
    sub.classList.toggle('pcu-live', !state.generating);
    setAvatar($id('pcu_h_av'), info.name, info.file);
}

/* ------------------------------------------------------------------ */
/* rendering the mirrored chat                                         */
/* ------------------------------------------------------------------ */
function callLabel(cl) {
    const d = fmtDuration(cl.durationSec || 0);
    if (cl.direction === 'out') return cl.status === 'answered' ? t('callOutDone', d) : t('callOutCancel');
    if (cl.status === 'answered') return t('callInDone', d);
    return cl.status === 'declined' ? t('callInDeclined') : t('callInMissed');
}

function buildItems() {
    const c = ctx();
    const chat = c.chat || [];
    const items = [];
    chat.forEach((msg, idx) => {
        if (!msg || msg.is_system) return;
        if (state.generating && state.genFrom != null && idx >= state.genFrom && !msg.is_user) return; // shown as "typing…"
        const text = plainText(msg.mes);
        if (!text) return;
        const who = msg.is_user ? 'user' : 'bot';
        const ts = parseStamp(msg.send_date);
        const file = who === 'bot' ? (charByName(msg.name)?.avatar ?? currentChar()?.avatar ?? null) : null;
        const parts = who === 'bot' ? text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [text];
        parts.forEach((p) => items.push({ kind: 'msg', who, text: p, ts, idx, name: msg.name, file }));
    });
    [...meta().calls].sort((a, b) => a.startMs - b.startMs).forEach((cl) => {
        const entry = { kind: 'call', call: cl, ts: new Date(cl.startMs) };
        const at = items.findIndex((it) => it.kind === 'msg' && it.ts && it.ts.getTime() > cl.startMs);
        if (at === -1) items.push(entry);
        else items.splice(at, 0, entry);
    });
    return items;
}

function renderMessages(mode = 'auto') {
    const box = $id('pcu_msgs');
    if (!box) return;
    const stick = mode === 'bottom' || (mode === 'auto' && box.scrollHeight - box.scrollTop - box.clientHeight < 140);

    const all = buildItems();
    const hidden = Math.max(0, all.length - state.renderLimit);
    const items = hidden ? all.slice(hidden) : all;
    const frag = document.createDocumentFragment();

    if (hidden) {
        const more = el('button', 'pcu-more', t('earlier'));
        more.type = 'button';
        more.addEventListener('click', () => {
            const before = box.scrollHeight;
            state.renderLimit += 80;
            renderMessages('none');
            box.scrollTop = box.scrollHeight - before;
        });
        frag.appendChild(more);
    }

    const me = userName();
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
            if (!nextSame) setAvatar(av, it.name, it.file);
            row.appendChild(av);
        }
        const col = el('div', 'pcu-col');
        const line = el('div', 'pcu-line');
        const bubble = el('div', 'pcu-bubble');

        const q = it.who === 'user' ? it.text.match(RE_QUOTE) : null;
        if (q) {
            const quote = el('div', 'pcu-quote');
            quote.appendChild(el('b', null, q[1]));
            quote.appendChild(el('span', null, q[2]));
            bubble.appendChild(quote);
            const body = el('div');
            fillRich(body, q[3]);
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
            setReply(it.who === 'user' ? me : (it.name || headerInfo().name), q ? q[3] : it.text);
        });
        bubble.addEventListener('click', () => row.classList.toggle('pcu-tap'));

        line.appendChild(bubble);
        line.appendChild(replyBtn);
        col.appendChild(line);
        if (!nextSame && it.ts) col.appendChild(el('div', 'pcu-time', fmtClock(it.ts)));
        row.appendChild(col);
        frag.appendChild(row);
    });

    if (state.generating) {
        const row = el('div', 'pcu-row bot');
        const info = headerInfo();
        const av = el('div', 'pcu-av pcu-av-xs');
        setAvatar(av, info.name, info.file);
        row.appendChild(av);
        const bubble = el('div', 'pcu-bubble pcu-typing');
        for (let k = 0; k < 3; k++) bubble.appendChild(el('span', 'pcu-dot'));
        row.appendChild(bubble);
        frag.appendChild(row);
    }

    box.textContent = '';
    box.appendChild(frag);
    if (stick) box.scrollTop = box.scrollHeight;
    updateHeader();
}

let rafId = 0;
let rafMode = 'auto';
function scheduleRender(mode = 'auto') {
    if (!state.open) return;
    if (mode === 'bottom') rafMode = 'bottom';
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        rafId = 0;
        const m = rafMode;
        rafMode = 'auto';
        renderMessages(m);
    });
}

/* ------------------------------------------------------------------ */
/* sending (through ST's own send button) + replies                    */
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

function sendFromPhone() {
    const input = $id('pcu_input');
    let text = input.value.trim();
    if (!text) return;
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
    if (state.replyTo) text = `↩ ${state.replyTo.name}: "${state.replyTo.snippet.replace(/"/g, "'")}"\n${text}`;

    const previous = ta.value; // don't lose what the user was typing in ST's own box
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    btn.click();
    if (previous) setTimeout(() => { if (!ta.value) ta.value = previous; }, 150);

    input.value = '';
    autoGrow(input);
    clearReply();
    scheduleRender('bottom');
}

// our "generating" flag comes from events; if an end event was ever missed, ST's own stop button tells the truth
function generationLooksStuck() {
    if (Date.now() - state.genAt < 4000) return false;
    const stop = document.getElementById('mes_stop');
    return !!stop && getComputedStyle(stop).display === 'none';
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

function showNotification({ name, text, file = null }) {
    const n = $id('pcu_notif');
    if (!n) return;
    setAvatar($id('pcu_n_av'), name, file);
    $id('pcu_n_name').textContent = name;
    $id('pcu_n_time').textContent = fmtClock(new Date());
    $id('pcu_n_text').textContent = text;
    n.classList.add('pcu-show');
    ping();
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => n.classList.remove('pcu-show'), 4800);
}
const hideNotification = () => $id('pcu_notif')?.classList.remove('pcu-show');

/* ------------------------------------------------------------------ */
/* open / close                                                        */
/* ------------------------------------------------------------------ */
function fitViewport() {
    const root = $id('pcu_root');
    const vv = window.visualViewport;
    if (!root) return;
    root.style.height = vv ? `${vv.height}px` : '';
    root.style.top = vv ? `${vv.offsetTop}px` : '';
}

function openPhone() {
    buildSkeleton();
    state.open = true;
    $id('pcu_root').classList.add('pcu-visible');
    fitViewport();
    startClock();
    hideNotification();
    renderMessages('bottom');
    $id('pcu_toggle_button')?.classList.add('pcu-active');
}
function closePhone() {
    if (state.call || state.ringing) return; // finish the call first
    state.open = false;
    $id('pcu_root')?.classList.remove('pcu-visible');
    $id('pcu_cal').hidden = true;
    stopClock();
    $id('pcu_toggle_button')?.classList.remove('pcu-active');
}
const togglePhone = () => (state.open ? closePhone() : openPhone());

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

function openCalendar() {
    state.calMonth = startOfMonth(new Date());
    state.calSel = startOfDay(new Date());
    const d = new Date(state.calSel);
    d.setHours(9, 0, 0, 0);
    $id('pcu_cal_when').value = inputLocal(d);
    $id('pcu_cal').hidden = false;
    renderCalendar();
}

function renderCalendar() {
    const base = state.calMonth;
    const sel = state.calSel;
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
    let changed = false;
    m.events.forEach((ev) => {
        const at = new Date(ev.whenISO).getTime();
        if (!ev.notifiedPre && now >= at - 15 * 60000 && now < at) {
            ev.notifiedPre = true;
            changed = true;
            showNotification({ name: info.name, file: info.file, text: `⏰ ${t('remindPre', ev.title, Math.max(1, Math.round((at - now) / 60000)))}` });
        }
        if (!ev.notified && now >= at) {
            ev.notified = true;
            changed = true;
            if (now < at + 30 * 60000) showNotification({ name: info.name, file: info.file, text: `⏰ ${t('remindNow', ev.title)}` });
        }
    });
    if (changed) persist();
}

/* ------------------------------------------------------------------ */
/* calls (text-based "live" conversation)                              */
/* ------------------------------------------------------------------ */
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
    const bot = headerInfo().name;
    const me = userName();
    const first = !opening ? '' : call.direction === 'out'
        ? ` ${me} just called you and you picked up: say hello.`
        : ` You called ${me} and they just picked up: speak first.`;
    const lines = call.transcript.map((l) => `${l.who === 'user' ? me : bot}: ${l.text}`).join('\n');
    return `[A live voice phone call is in progress between you (${bot}) and ${me}. Reply ONLY with what you say out loud next, in character: 1-3 short sentences, no narration, no asterisks, no stage directions, no tags.${first}]${lines ? `\n${lines}` : ''}`;
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

function startCall(direction = 'out') {
    if (state.call || state.ringing) return;
    if (!state.open) openPhone();
    const info = headerInfo();
    const call = { id: uid(), direction, startMs: Date.now(), connectedMs: null, transcript: [], busy: false, ringTimer: null, timer: null };
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
        startMs: call.startMs,
        durationSec: answered ? Math.round((Date.now() - call.connectedMs) / 1000) : 0,
        status: answered ? 'answered' : 'cancelled',
        transcript: call.transcript.slice(-40),
    });
    persist();
    $id('pcu_call').hidden = true;
    renderMessages('bottom');
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

// the bot calls the user
function incomingCall() {
    if (state.call || state.ringing) return;
    if (!state.open) openPhone();
    const info = headerInfo();
    setAvatar($id('pcu_ring_av'), info.name, info.file);
    $id('pcu_ring_name').textContent = info.name;
    $id('pcu_ring_status').textContent = t('incoming');
    $id('pcu_ring').hidden = false;
    const ring = { startMs: Date.now(), timeout: null, tick: null };
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
        startCall('in');
        return;
    }
    meta().calls.push({ id: uid(), direction: 'in', startMs: ring.startMs, durationSec: 0, status: result, transcript: [] });
    persist();
    renderMessages('bottom');
}

/* ------------------------------------------------------------------ */
/* making the bot aware: current time, calendar, calls                 */
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
    const s = S();
    const now = new Date();
    const me = userName();
    const bot = headerInfo().name;
    const out = [`[Phone mode is ON: you and ${me} are texting on smartphones.`];
    out.push(`Current real date and time: ${now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (local time, ${isoLocal(now)}).`);
    if (s.textStyle) out.push('Write like real text messages: short, natural, in character, no long narration. Put each separate message in its own paragraph (blank line between), at most three.');

    const evs = upcomingEvents(now);
    if (evs.length) {
        out.push('Shared calendar (upcoming appointments):');
        evs.forEach((e) => out.push(`- ${EN_WEEKDAYS[e.at.getDay()]} ${isoLocal(e.at)} ${e.title}`));
    }

    const calls = recentCalls(now);
    if (calls.length) {
        out.push('Recent phone calls:');
        calls.forEach((c) => {
            const at = isoLocal(new Date(c.startMs)).slice(11);
            const dur = fmtDuration(c.durationSec || 0);
            let desc;
            if (c.direction === 'out') desc = c.status === 'answered' ? `${me} called you and you talked for ${dur}.` : `${me} tried to call you but hung up before you answered.`;
            else if (c.status === 'answered') desc = `you called ${me}, they picked up (${dur}).`;
            else desc = c.status === 'declined' ? `you called ${me} but they declined.` : `you called ${me} but they did not pick up.`;
            out.push(`- ${at} ${desc}`);
            (c.transcript || []).slice(-8).forEach((l) => out.push(`    ${l.who === 'user' ? me : bot}: ${String(l.text).slice(0, 160)}`));
        });
    }
    out.push(`Optional hidden tags (the phone app hides them; use only when it fits naturally): [[calendar: <title> || YYYY-MM-DD HH:mm]] to add an appointment you and ${me} agreed on; [[call]] to ring ${me}'s phone (rarely).]`);
    return out.join('\n').slice(0, 2400);
}

// referenced by "generate_interceptor" in manifest.json
globalThis.pcuInterceptor = async function pcuInterceptor(chat, _contextSize, _abort, type) {
    try {
        if (!S().injectContext || !phoneMode() || type === 'impersonate') return;
        chat.splice(Math.max(0, chat.length - 1), 0, {
            is_user: false,
            is_system: false,
            name: 'Phone',
            send_date: Date.now(),
            mes: buildContextNote(),
        });
    } catch (err) {
        console.error(TAG, 'interceptor failed', err);
    }
};

/* ------------------------------------------------------------------ */
/* SillyTavern events                                                  */
/* ------------------------------------------------------------------ */
async function onMessageReceived(mesId) {
    const c = ctx();
    const msg = c.chat?.[Number.isInteger(mesId) ? mesId : c.chat.length - 1];
    if (!msg || msg.is_user || msg.is_system) return;
    const raw = String(msg.mes ?? '');

    for (const m of raw.matchAll(RE_TAG_CAL)) {
        const when = parseWhen(m[2]);
        if (when && await addEvent(m[1], when, 'bot')) {
            toast(`📅 ${t('apptAdded', m[1].trim())}`, 'success');
            if (state.open && !$id('pcu_cal').hidden) renderCalendar();
        }
    }

    if (RE_TAG_CALL.test(raw)) {
        incomingCall();
        return;
    }
    if (S().notifications && !state.open) {
        const first = noAsterisks(plainText(raw).split(/\n{2,}/)[0] ?? '');
        if (first) showNotification({ name: msg.name || headerInfo().name, file: charByName(msg.name)?.avatar ?? currentChar()?.avatar ?? null, text: first.slice(0, 90) });
    }
}

function onGenerationStarted(type, _params, dryRun) {
    if (dryRun || type === 'quiet' || type === 'impersonate') return;
    const len = ctx().chat?.length ?? 0;
    state.generating = true;
    state.genAt = Date.now();
    state.genFrom = type === 'continue' ? null : (type === 'swipe' || type === 'regenerate') ? Math.max(0, len - 1) : len;
    scheduleRender();
}
function onGenerationEnded() {
    if (!state.generating) return;
    state.generating = false;
    state.genFrom = null;
    scheduleRender();
}
function onChatChanged() {
    state.generating = false;
    state.genFrom = null;
    state.renderLimit = 80;
    clearReply();
    abortCallAndRing();
    if (state.open) renderMessages('bottom');
    if (state.open && !$id('pcu_cal').hidden) renderCalendar();
}

function registerEvents() {
    const { eventSource, event_types: E } = ctx();
    const on = (name, fn) => { if (E[name]) eventSource.on(E[name], fn); };
    on('MESSAGE_RECEIVED', onMessageReceived);
    on('CHARACTER_MESSAGE_RENDERED', () => scheduleRender());
    on('USER_MESSAGE_RENDERED', () => scheduleRender('bottom'));
    on('MESSAGE_SWIPED', () => scheduleRender());
    on('MESSAGE_DELETED', () => scheduleRender());
    on('MESSAGE_EDITED', () => scheduleRender());
    on('GENERATION_STARTED', onGenerationStarted);
    on('GENERATION_ENDED', onGenerationEnded);
    on('GENERATION_STOPPED', onGenerationEnded);
    on('CHAT_CHANGED', onChatChanged);
}

/* ------------------------------------------------------------------ */
/* DOM event wiring                                                    */
/* ------------------------------------------------------------------ */
function wireHandlers() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    $id('pcu_close').addEventListener('click', closePhone);
    $id('pcu_btn_cal').addEventListener('click', openCalendar);
    $id('pcu_btn_call').addEventListener('click', () => startCall('out'));
    $id('pcu_send').addEventListener('click', sendFromPhone);
    $id('pcu_reply_x').addEventListener('click', clearReply);

    const input = $id('pcu_input');
    input.addEventListener('input', () => autoGrow(input));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.isComposing) {
            e.preventDefault();
            sendFromPhone();
        }
    });

    $id('pcu_cal_back').addEventListener('click', () => { $id('pcu_cal').hidden = true; });
    $id('pcu_cal_prev').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderCalendar(); });
    $id('pcu_cal_next').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderCalendar(); });
    $id('pcu_cal_add').addEventListener('click', addEventFromForm);
    $id('pcu_cal_title').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addEventFromForm(); });

    $id('pcu_call_end').addEventListener('click', endCall);
    $id('pcu_call_send').addEventListener('click', sendCallLine);
    $id('pcu_call_input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) sendCallLine(); });

    $id('pcu_ring_yes').addEventListener('click', () => resolveRing('accepted'));
    $id('pcu_ring_no').addEventListener('click', () => resolveRing('declined'));

    $id('pcu_notif').addEventListener('click', () => { hideNotification(); openPhone(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.open && !state.call && !state.ringing) {
            if (!$id('pcu_cal').hidden) $id('pcu_cal').hidden = true;
            else closePhone();
        }
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
            ${[['notifications', 'setNotifications'], ['reminders', 'setReminders'], ['injectContext', 'setInject'], ['textStyle', 'setStyle'], ['sound', 'setSound']]
                .map(([k, label]) => `<label class="checkbox_label"><input type="checkbox" data-k="${k}"${s[k] ? ' checked' : ''}><span>${t(label)}</span></label>`).join('')}
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
            saveSettings();
        });
    });
    $id('pcu_test_ring').addEventListener('click', incomingCall);
    $id('pcu_test_notif').addEventListener('click', () => {
        const info = headerInfo();
        showNotification({ name: info.name, file: info.file, text: t('testNotifText') });
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
    retryUntilReady(addMenuButton);
    retryUntilReady(buildSettingsPanel);
    reminderTimer = setInterval(checkReminders, 20000);
    console.log(TAG, 'loaded');
}

// small public API: handy for debugging from the browser console
globalThis.PhoneChatUI = { open: openPhone, close: closePhone, toggle: togglePhone, incomingCall, startCall, parseWhen, buildContextNote, checkReminders };

(function init() {
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.APP_READY, boot);
})();
