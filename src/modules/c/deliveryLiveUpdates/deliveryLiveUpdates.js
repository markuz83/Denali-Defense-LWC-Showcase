import { subscribe, unsubscribe, onError, isEmpEnabled } from 'lightning/empApi';

// Change Data Capture channels for the objects whose changes the Denali components show.
// Enabled by platformEventChannelMembers/ChangeEvents_*_ChangeEvent.
const CHANNELS = ['/data/Deliverable__ChangeEvent', '/data/Deliverable_Update__ChangeEvent'];
const DEFAULT_DEBOUNCE_MS = 800;

let errorHandlerRegistered = false;

/**
 * Subscribes to Deliverable and Deliverable Update changes made by anyone (users, flows,
 * integrations) and calls onChanges with a debounced batch of
 * { entity, changeType, recordIds, payload }. Resolves to an unsubscribe function.
 *
 * Streaming (lightning/empApi) isn't available in the Salesforce mobile app; there this
 * resolves to a no-op and the component simply doesn't update live.
 */
export async function subscribeToDeliveryChanges(onChanges, debounceMs = DEFAULT_DEBOUNCE_MS) {
    let enabled = false;
    try {
        enabled = await isEmpEnabled();
    } catch {
        enabled = false;
    }
    if (!enabled) {
        return { live: false, unsubscribe: () => {} };
    }
    if (!errorHandlerRegistered) {
        onError((error) => {
            console.warn('Denali live updates: streaming error', JSON.stringify(error));
        });
        errorHandlerRegistered = true;
    }

    let timer;
    let pending = [];
    const handler = (message) => {
        const payload = message?.data?.payload || {};
        const header = payload.ChangeEventHeader || {};
        pending.push({
            entity: header.entityName,
            changeType: header.changeType,
            recordIds: header.recordIds || [],
            payload
        });
        clearTimeout(timer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        timer = setTimeout(() => {
            const batch = pending;
            pending = [];
            onChanges(batch);
        }, debounceMs);
    };

    const subscriptions = await Promise.all(CHANNELS.map((channel) => subscribe(channel, -1, handler).catch(() => null)));
    const active = subscriptions.filter(Boolean);
    return {
        live: active.length > 0,
        unsubscribe: () => {
            clearTimeout(timer);
            active.forEach((s) => unsubscribe(s, () => {}));
        }
    };
}

// Lookups the flows stamp on these records (Deliverable_Defaults sets a deliverable's Account,
// Deliverable_Update_Intake an update's Project), so a change event says where a record belongs.
const PARENT_FIELDS = ['Account__c', 'Project__c', 'Deliverable__c'];

/**
 * A gap event (GAP_CREATE, GAP_UPDATE, ..., GAP_OVERFLOW) means Salesforce couldn't send the
 * change itself, or dropped some changes under load: what changed isn't known, so reload.
 */
export function isGap(change) {
    return String(change.changeType || '').startsWith('GAP_');
}

/**
 * True when a batch can change what a component shows, so it should refresh:
 * - a change to one of the records it shows (ids);
 * - a record created under, or moved to, one of its parents (parentIds): the event payload's
 *   Account__c, Project__c or Deliverable__c is one of them. An update event carries only the
 *   fields that changed, so this matches a move but not an edit, which ids covers;
 * - a gap event.
 * Anything else (another account's or project's records) is ignored, so a busy org doesn't
 * reload every open page on every change.
 */
export function affects(batch, { ids = new Set(), parentIds = new Set() } = {}) {
    return batch.some(
        (c) =>
            isGap(c) ||
            c.recordIds.some((id) => ids.has(id)) ||
            PARENT_FIELDS.some((f) => c.payload && c.payload[f] && parentIds.has(c.payload[f]))
    );
}
