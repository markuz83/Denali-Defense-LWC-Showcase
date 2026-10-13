/**
 * lightning/navigation for the showcase. There's no Lightning Experience to navigate in,
 * so Navigate shows a toast saying where the platform would have gone.
 */
import Toast from 'lightning/toast';
import { describeRecord } from '../recordNames.js';

const Navigate = Symbol('Navigate');
const GenerateUrl = Symbol('GenerateUrl');

function describe(pageRef) {
    const { type, attributes = {} } = pageRef || {};
    if (type === 'standard__recordPage') return `the ${describeRecord(attributes.recordId)} record page`;
    if (type === 'standard__objectPage' && attributes.actionName === 'new') return `the New ${attributes.objectApiName.replace(/__c$/, '').replace(/_/g, ' ')} form`;
    if (type === 'standard__objectPage') return `the ${attributes.objectApiName} list`;
    return 'another page';
}

export function NavigationMixin(Base) {
    return class extends Base {
        [Navigate](pageRef) {
            Toast.show({ label: 'Navigation', message: `In Salesforce, this opens ${describe(pageRef)}.`, variant: 'info', mode: 'dismissible' });
        }

        [GenerateUrl]() {
            return Promise.resolve('#');
        }
    };
}
NavigationMixin.Navigate = Navigate;
NavigationMixin.GenerateUrl = GenerateUrl;

export const CurrentPageReference = class {
    constructor(dataCallback) {
        this.dataCallback = dataCallback;
    }
    connect() {
        this.dataCallback({ type: 'standard__namedPage', attributes: {}, state: {} });
    }
    disconnect() {}
    update() {}
};
