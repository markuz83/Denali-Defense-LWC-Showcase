import { LightningElement, api } from 'lwc';
import { USERS } from '../../denaliData.js';

/**
 * lightning-record-picker for the showcase. The real picker searches records through the
 * UI API; this one offers the sample users in a lightning-combobox and fires the same
 * change event ({ recordId }).
 */
export default class RecordPicker extends LightningElement {
    @api label;
    @api placeholder;
    @api objectApiName;
    @api filter;
    @api displayInfo;
    @api matchingInfo;
    @api required = false;
    @api disabled = false;
    @api value;

    get options() {
        return USERS.map((u) => ({ label: u.Name, value: u.Id }));
    }

    handleChange(event) {
        event.stopPropagation();
        this.value = event.detail.value;
        this.dispatchEvent(new CustomEvent('change', { detail: { recordId: this.value } }));
    }
}
