// Formatting helpers shared by the Denali components, so a fix made in one place reaches all of them.

const DAY_MS = 24 * 60 * 60 * 1000;

// Every Denali component formats in US English and US dollars, on purpose: the customer is a US
// federal contractor, its contracts are in dollars, and the demo org has a single currency. All
// the components' number and date formats use LOCALE and CURRENCY, so following each user's
// settings instead is a change here: import them from @salesforce/i18n/locale and
// @salesforce/i18n/currency, and swap commandCenterTimeline's English month abbreviations for
// a formatter. (Datatable date and currency columns already follow the user.)
export const LOCALE = 'en-US';
export const CURRENCY = 'USD';

export const USD = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
export const USD_COMPACT = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 });

/** Compact dollars ($1.2M), with no value shown as $0. */
export const money = (v) => USD_COMPACT.format(v || 0);

/** A percent field's value (40 for 40%) to one decimal place, or an em dash when empty. */
export const pctLabel = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`);

/**
 * A record's URL, for the href of a link that navigates with NavigationMixin. The href makes
 * the link keyboard-focusable and opens in a new tab on Ctrl/Cmd-click; the click handler
 * calls preventDefault() and navigates in place.
 */
export const recordUrl = (id) => (id ? `/${id}` : null);

/**
 * A Salesforce Date ("2026-01-01", or the date part of a Datetime string) as a local Date.
 * new Date("2026-01-01") reads it as midnight UTC, which is the previous evening anywhere in
 * the Americas, so a date shown with it lands a day (or a month, or a year) early.
 */
export function parseDate(value) {
    if (!value) return null;
    const [y, m, d] = String(value).substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Whole days from today to a Date value: negative when it's past, null when there's no date. */
export function daysUntil(value) {
    const d = parseDate(value);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / DAY_MS);
}

/** A readable message from an Apex or Lightning Data Service error, including multi-error bodies. */
export function reduceError(error) {
    if (!error) return 'Unknown error';
    if (Array.isArray(error.body)) return error.body.map((e) => e.message).join(', ');
    return error.body?.message || error.message || 'Unknown error';
}
