import { LightningElement } from 'lwc';
import { navigate, linkHref, shouldHandleLink } from '../../../router';
import { showcase } from '../../../showcase.config';

/** Landing tab: what the showcase is, and a card per component that opens its tab. */
export default class Overview extends LightningElement {
    get cards() {
        return showcase.map((e) => ({
            key: e.id,
            path: `/${e.id}`,
            href: linkHref(`/${e.id}`),
            label: e.label,
            placement: e.placement,
            summary: e.summary
        }));
    }

    get count() {
        return showcase.length;
    }

    handleOpen(event) {
        if (!shouldHandleLink(event)) return;
        event.preventDefault();
        navigate(event.currentTarget.dataset.path);
    }
}
