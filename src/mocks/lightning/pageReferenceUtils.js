/** lightning/pageReferenceUtils: encodes default field values the way the platform does. */
export function encodeDefaultFieldValues(values = {}) {
    return Object.entries(values)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join(',');
}

export function decodeDefaultFieldValues(encoded = '') {
    return Object.fromEntries(
        encoded
            .split(',')
            .filter(Boolean)
            .map((pair) => pair.split('=').map(decodeURIComponent))
    );
}
