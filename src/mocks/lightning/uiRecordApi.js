/**
 * The parts of lightning/uiRecordApi the Denali components use. getRecord provisions the
 * requested fields of a sample record; notifyRecordUpdateAvailable has no cache to refresh.
 */
import { findRecord } from '../recordNames.js';
import { onStateChange } from '../apexHandlers.js';

export class getRecord {
    constructor(dataCallback) {
        this.dataCallback = dataCallback;
        this.config = undefined;
        this.off = undefined;
    }

    connect() {
        this.off = onStateChange(() => this.emit());
    }

    disconnect() {
        this.off?.();
    }

    update(config) {
        this.config = config;
        this.emit();
    }

    emit() {
        const { recordId, fields = [] } = this.config || {};
        if (!recordId) return;
        const record = findRecord(recordId) || {};
        const out = {};
        fields.forEach((f) => {
            const name = typeof f === 'string' ? f.split('.').pop() : f.fieldApiName;
            const value = name === 'LastModifiedDate' ? record.LastModifiedDate || 'initial' : record[name];
            out[name] = { value: value === undefined ? null : value, displayValue: null };
        });
        this.dataCallback({ data: { id: recordId, fields: out }, error: undefined });
    }
}

export function notifyRecordUpdateAvailable() {
    return Promise.resolve();
}

export function getFieldValue(record, field) {
    const name = typeof field === 'string' ? field.split('.').pop() : field.fieldApiName;
    return record?.fields?.[name]?.value;
}
