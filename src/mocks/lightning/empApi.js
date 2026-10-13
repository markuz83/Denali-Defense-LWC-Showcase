/**
 * lightning/empApi for the showcase: an in-page message bus standing in for the Streaming API.
 * publishChange() (the "Simulate a supplier update" button) delivers a Change Data Capture
 * style message to every subscriber of the channel.
 */
const subscribers = new Map();
let errorHandler;

export function isEmpEnabled() {
    return Promise.resolve(true);
}

export function onError(handler) {
    errorHandler = handler;
}

export function setDebugFlag() {
    return Promise.resolve();
}

export function subscribe(channel, replayId, onMessage) {
    const subscription = { channel, id: Symbol(channel), onMessage };
    if (!subscribers.has(channel)) subscribers.set(channel, new Set());
    subscribers.get(channel).add(subscription);
    return Promise.resolve(subscription);
}

export function unsubscribe(subscription, callback) {
    subscribers.get(subscription?.channel)?.delete(subscription);
    callback?.({ successful: true });
    return Promise.resolve(true);
}

/** Delivers a change event ({ entityName, changeType, recordIds }) to its CDC channel. */
export function publishChange({ entityName, changeType, recordIds }) {
    const channel = `/data/${entityName.replace(/__c$/, '__')}ChangeEvent`;
    const message = { channel, data: { payload: { ChangeEventHeader: { entityName, changeType, recordIds } } } };
    try {
        subscribers.get(channel)?.forEach((s) => s.onMessage(message));
    } catch (e) {
        errorHandler?.(e);
    }
}
