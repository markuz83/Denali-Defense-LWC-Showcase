/**
 * lightning/platformShowToastEvent for the showcase. On the platform, Lightning Experience
 * listens for this event and shows the toast; here the event shows it with lightning/toast.
 * It's named differently from lightning/showToastEvent's event so the starter kit's toast
 * container doesn't try to show it a second time.
 */
import Toast from 'lightning/toast';

export class ShowToastEvent extends CustomEvent {
    constructor(config = {}) {
        super('denali__showtoast', { bubbles: true, composed: true, cancelable: true, detail: config });
        Toast.show({ label: config.title, message: config.message, variant: config.variant || 'info', mode: 'dismissible' });
    }
}
