/**
 * What `@salesforce/apex/<Class>.<method>` and `@salesforce/apex` resolve to in the showcase
 * (see vite-plugins/salesforce-mocks.js). An imported method works both ways the platform
 * allows: called imperatively it returns a Promise, and used with @wire it provisions
 * { data, error }. Wire config values that are undefined hold the wire back, as on the platform.
 */
import { handlers, onStateChange } from './apexHandlers.js';

const LATENCY_MS = 250;
const wiredValues = new WeakMap();
const liveAdapters = new Set();

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

function invoke(name, params) {
    const handler = handlers[name];
    if (!handler) {
        return Promise.reject(Object.assign(new Error(`No mock for ${name}`), { body: { message: `No mock for ${name}` } }));
    }
    return wait().then(() => clone(handler(params || {})));
}

export function createApexMethod(name) {
    const method = (params) => invoke(name, params);

    class ApexWireAdapter {
        constructor(dataCallback) {
            this.dataCallback = dataCallback;
            this.config = undefined;
        }

        connect() {
            liveAdapters.add(this);
        }

        disconnect() {
            liveAdapters.delete(this);
        }

        update(config) {
            this.config = config || {};
            this.emit();
        }

        emit() {
            if (this.config === undefined) return Promise.resolve();
            if (Object.values(this.config).some((v) => v === undefined)) return Promise.resolve();
            return invoke(name, this.config).then(
                (data) => this.provide({ data, error: undefined }),
                (error) => this.provide({ data: undefined, error })
            );
        }

        provide(value) {
            wiredValues.set(value, this);
            this.dataCallback(value);
        }
    }

    method.adapter = ApexWireAdapter;
    return method;
}

/** Re-runs the wire that provisioned `wiredValue` and pushes its fresh result. */
export function refreshApex(wiredValue) {
    const adapter = wiredValue && wiredValues.get(wiredValue);
    return adapter ? adapter.emit() : Promise.resolve();
}

// Sample data changed (a decision, a reset): refresh every wired component, the way the
// platform's cache would on the next refresh.
onStateChange(() => {
    liveAdapters.forEach((a) => a.emit());
});
