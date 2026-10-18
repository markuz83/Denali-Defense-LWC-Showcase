import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import getChain from '@salesforce/apex/ImpactChainController.getChain';
import DELIVERABLE from '@salesforce/schema/Case.Deliverable__c';
import PROJECT from '@salesforce/schema/Case.Project__c';
import SERVICE_ENGAGEMENT from '@salesforce/schema/Case.Service_Engagement__c';
import LAST_MODIFIED from '@salesforce/schema/Case.LastModifiedDate';
import { LOCALE, USD_COMPACT, parseDate, daysUntil, recordUrl, reduceError } from 'c/denaliFormat';

const DATE = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
const HEALTH_DOT = { Green: 'dot dot-green', Yellow: 'dot dot-yellow', Red: 'dot dot-red' };
const money = (v) => (v === null || v === undefined ? null : USD_COMPACT.format(v));

function fmtDate(value) {
    return value ? DATE.format(parseDate(value)) : null;
}

// The lookups the chain follows, and LastModifiedDate to catch any other edit to the case
// (severity, status) shown in the headline.
const WATCHED_FIELDS = [DELIVERABLE, PROJECT, SERVICE_ENGAGEMENT, LAST_MODIFIED];

const isSevere = (severity) => /^Sev [12]/.test(severity || '');

/**
 * What this case puts at risk upstream: Case -> Deliverable -> Project -> Contract, the
 * revenue milestone at stake, and the open risks logged against them. A support case with no
 * Deliverable or Project goes Case -> Service -> Contract instead.
 */
export default class ImpactChain extends NavigationMixin(LightningElement) {
    @api recordId;
    chain;
    error;
    loaded = false;
    wiredResult;
    lastModified;

    // Linking a Deliverable (or any other edit) on the same page changes the chain, but the Apex
    // result is cached; reload it when the case changes, as marginGuardrail does.
    @wire(getRecord, { recordId: '$recordId', fields: WATCHED_FIELDS })
    watchRecord({ data }) {
        const stamp = data?.fields?.LastModifiedDate?.value;
        if (stamp && this.lastModified && stamp !== this.lastModified && this.wiredResult) {
            refreshApex(this.wiredResult);
        }
        if (stamp) this.lastModified = stamp;
    }

    @wire(getChain, { caseId: '$recordId' })
    wired(result) {
        this.wiredResult = result;
        const { data, error } = result;
        if (data !== undefined) {
            this.chain = data;
            this.error = undefined;
            this.loaded = true;
        } else if (error) {
            this.error = reduceError(error);
            this.loaded = true;
        }
    }

    get isLoading() {
        return !this.loaded;
    }

    get hasUpstream() {
        return !!(this.chain && (this.chain.deliverable || this.chain.project || this.chain.contract));
    }

    // getChain returns null when the case can't be read (deleted, or not shared with the user).
    get notFound() {
        return this.loaded && !this.error && !this.chain;
    }

    get noUpstream() {
        return this.loaded && this.chain && !this.hasUpstream;
    }

    get headline() {
        const c = this.chain;
        const sev = c.caseRecord.Severity__c ? c.caseRecord.Severity__c.split(' - ')[0] : 'This case';
        if (c.revenueAtStake && c.contract) {
            return `${sev} puts a ${money(c.revenueAtStake)} milestone at risk on ${c.contract.Award_Number__c || c.contract.ContractNumber}.`;
        }
        if (c.deliverable) {
            return `${sev} affects ${c.deliverable.Name}.`;
        }
        if (c.project) {
            return `${sev} affects ${c.project.Name}.`;
        }
        return this.serviceHeadline(sev);
    }

    // A support case reached through its Service Engagement: the service's value, and how close
    // the contract's next option decision is.
    serviceHeadline(sev) {
        const c = this.chain;
        const award = c.contract.Award_Number__c || c.contract.ContractNumber;
        const acv = money(c.serviceEngagement?.Annual_Contract_Value__c);
        const subject = c.serviceEngagement ? `${c.serviceEngagement.Name}${acv ? `, a ${acv}/yr service` : ''}` : award;
        const days = daysUntil(c.contract.Next_Option_Date__c);
        if (days !== null && days >= 0) {
            return `${sev} on ${subject}, ${days} day${days === 1 ? '' : 's'} before the ${award} option decision.`;
        }
        return `${sev} on ${subject} (${award}).`;
    }

    get headlineClass() {
        const c = this.chain;
        const serviceAlert = !c.deliverable && !c.project && isSevere(c.caseRecord.Severity__c);
        return c.revenueAtStake || serviceAlert ? 'headline headline-alert' : 'headline';
    }

    get nodes() {
        const c = this.chain;
        const nodes = [];
        const cs = c.caseRecord;
        nodes.push({
            key: 'case',
            id: cs.Id,
            kind: 'Case',
            name: `${cs.CaseNumber} · ${cs.Subject || ''}`,
            dotClass: isSevere(cs.Severity__c) ? 'dot dot-red' : 'dot',
            lines: [[cs.Severity__c, cs.Customer_Impact__c].filter(Boolean).join(' · '),
                [cs.Status, cs.IsEscalated && 'Escalated', cs.Priority && `${cs.Priority} priority`].filter(Boolean).join(' · ')]
        });
        if (c.serviceEngagement) {
            const se = c.serviceEngagement;
            nodes.push({
                key: 'se',
                id: se.Id,
                kind: 'Service',
                name: se.Name,
                dotClass: HEALTH_DOT[se.Health__c] || 'dot',
                lines: [[se.Service_Type__c, se.Service_Level__c && `${se.Service_Level__c} SLA`, se.SLA_Breaches__c && `${se.SLA_Breaches__c} breaches`]
                    .filter(Boolean).join(' · '),
                    money(se.Annual_Contract_Value__c) && `${money(se.Annual_Contract_Value__c)} a year`]
            });
        }
        if (c.deliverable) {
            const d = c.deliverable;
            const slip = d.Schedule_Variance_Days__c > 0 ? `${d.Schedule_Variance_Days__c}d late (forecast ${fmtDate(d.Forecast_Completion_Date__c)})` : null;
            nodes.push({
                key: 'del',
                id: d.Id,
                kind: 'Deliverable',
                name: d.Name,
                dotClass: HEALTH_DOT[d.Health__c] || 'dot',
                lines: [[d.Status__c, d.Percent_Complete__c !== null && d.Percent_Complete__c !== undefined && `${Math.round(d.Percent_Complete__c)}%`,
                    d.Due_Date__c && `due ${fmtDate(d.Due_Date__c)}`].filter(Boolean).join(' · '),
                    [slip, d.Supplier__r?.Name && `Supplier: ${d.Supplier__r.Name}`].filter(Boolean).join(' · '),
                    [money(d.Revenue_Milestone__c) && `${money(d.Revenue_Milestone__c)} milestone`, d.Acceptance_Status__c].filter(Boolean).join(' · ')]
            });
        }
        if (c.project) {
            const p = c.project;
            nodes.push({
                key: 'proj',
                id: p.Id,
                kind: 'Project',
                name: p.Name,
                dotClass: HEALTH_DOT[p.Health__c] || 'dot',
                lines: [[p.Status__c, p.Percent_Complete__c !== null && p.Percent_Complete__c !== undefined && `${Math.round(p.Percent_Complete__c)}%`,
                    p.Project_Manager__r?.Name && `PM ${p.Project_Manager__r.Name}`].filter(Boolean).join(' · '),
                    p.Margin_Erosion__c < 0 ? `Forecast margin ${Number(p.Forecast_Margin__c).toFixed(1)}% (${Number(p.Margin_Erosion__c).toFixed(1)} pts vs bid)` : '']
            });
        }
        if (c.contract) {
            const k = c.contract;
            nodes.push({
                key: 'contract',
                id: k.Id,
                kind: 'Contract',
                name: k.Award_Number__c || k.ContractNumber,
                dotClass: HEALTH_DOT[k.Contract_Health__c] || 'dot',
                lines: [[k.Status, money(k.Contract_Value__c) && `${money(k.Contract_Value__c)} value`, money(k.Total_Backlog__c) && `${money(k.Total_Backlog__c)} backlog`]
                    .filter(Boolean).join(' · '),
                    k.Next_Option_Date__c ? `Next option decision ${fmtDate(k.Next_Option_Date__c)}` : '']
            });
        }
        return nodes.map((n, i) => ({
            ...n,
            url: recordUrl(n.id),
            lines: n.lines.filter(Boolean).map((text, j) => ({ key: `${n.key}-${j}`, text })),
            nodeClass: i === nodes.length - 1 ? 'node node-last' : 'node'
        }));
    }

    get hasRisks() {
        return this.chain.risks && this.chain.risks.length > 0;
    }

    get risks() {
        return this.chain.risks.map((r) => ({
            id: r.Id,
            url: recordUrl(r.Id),
            name: r.Name,
            meta: [r.Severity__c || 'Unscored', r.Status__c, r.Risk_Category__c].filter(Boolean).join(' · ')
        }));
    }

    handleOpen(event) {
        event.preventDefault();
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: event.currentTarget.dataset.id, actionName: 'view' }
        });
    }
}
