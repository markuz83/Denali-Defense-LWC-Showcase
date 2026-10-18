import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { encodeDefaultFieldValues } from 'lightning/pageReferenceUtils';
import { refreshApex } from '@salesforce/apex';
import getData from '@salesforce/apex/AccountCommandCenterController.getData';
import getPickerAccounts from '@salesforce/apex/AccountCommandCenterController.getPickerAccounts';
import { subscribeToDeliveryChanges, affects } from 'c/deliveryLiveUpdates';
import { url, reduceError } from 'c/accountSectionUtils';
import { money } from 'c/denaliFormat';
import { healthBadgeClass, healthLabel, kpiTiles, contractCard, deliveryTree, expandedIds, isSevereCase } from 'c/commandCenterModel';

// No fixed widths: the tree grid sizes each column to its content (column-widths-mode="auto").
const TREE_COLUMNS = [
    { type: 'url', fieldName: 'url', label: 'Name', typeAttributes: { label: { fieldName: 'name' } } },
    { type: 'text', fieldName: 'kind', label: 'Type' },
    { type: 'text', fieldName: 'status', label: 'Status' },
    {
        type: 'text',
        fieldName: 'health',
        label: 'Health',
        cellAttributes: { alignment: 'center' }
    },
    { type: 'percent', fieldName: 'pct', label: '% Done', typeAttributes: { maximumFractionDigits: 0 } },
    { type: 'date-local', fieldName: 'due', label: 'Due / End' },
    { type: 'date-local', fieldName: 'forecast', label: 'Forecast' },
    { type: 'number', fieldName: 'slip', label: 'Slip (days)', cellAttributes: { class: { fieldName: 'slipClass' } } },
    { type: 'currency', fieldName: 'revenue', label: 'Value', typeAttributes: { maximumFractionDigits: 0 } },
    { type: 'text', fieldName: 'flags', label: 'Flags', wrapText: true }
];

// Rendered by c-health-datatable: "health" draws an SLDS status icon, "score" a met/breached SLA icon.
const SERVICE_COLUMNS = [
    { type: 'url', fieldName: 'url', label: 'Engagement', typeAttributes: { label: { fieldName: 'name' } } },
    { type: 'text', fieldName: 'type', label: 'Type' },
    { type: 'health', fieldName: 'health', label: 'Health', cellAttributes: { alignment: 'center' } },
    { type: 'number', fieldName: 'casesOpen', label: 'Open Cases' },
    {
        type: 'score',
        fieldName: 'slaBreaches',
        label: 'SLA Breaches',
        typeAttributes: { option: { fieldName: 'slaOption' }, label: { fieldName: 'slaLabel' } }
    },
    { type: 'date-local', fieldName: 'nextMilestone', label: 'Next Milestone' }
];

const CASE_COLUMNS = [
    { type: 'url', fieldName: 'url', label: 'Case', initialWidth: 95, typeAttributes: { label: { fieldName: 'number' } } },
    { type: 'text', fieldName: 'subject', label: 'Subject', wrapText: true },
    { type: 'text', fieldName: 'severity', label: 'Severity', cellAttributes: { class: { fieldName: 'severityClass' } } },
    { type: 'text', fieldName: 'status', label: 'Status' },
    { type: 'text', fieldName: 'impact', label: 'Deliverable' }
];

/**
 * One screen for everything happening on an account: KPIs, contracts, the contract ->
 * project -> deliverable tree, a delivery timeline, the risk heat map, and service. Supplier
 * updates, suppliers and the team are separate components (accountSupplierUpdates,
 * accountSuppliers, accountTeam) to place on the page alongside it. On an Account record page it
 * uses the record; on an app page it shows a drop-down of active customers, labelled with their
 * award numbers.
 */
export default class AccountCommandCenter extends NavigationMixin(LightningElement) {
    _recordId;
    accountId;
    data;
    error;
    wiredResult;
    atRiskOnly = false;
    // Built when the data or the at-risk toggle changes, not in a getter: the tree is read three
    // times a render, and a new array each time would make the tree grid redraw.
    treeData = [];
    expandedRows = [];
    live = false;
    accountOptions;

    treeColumns = TREE_COLUMNS;
    serviceColumns = SERVICE_COLUMNS;
    caseColumns = CASE_COLUMNS;

    // No longer used, but it can't be removed: a deploy can't drop a design property while the
    // component is on any Lightning page in the org, even pages that don't set it. Removing it
    // would fail every redeploy to an org that already has the kit (the Account record page and
    // the Account Command Center app page both use the component), short of taking the component
    // off those pages and putting it back in each org.
    @api hideSuppliersAndTeam = false;

    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        this.accountId = value;
    }

    @wire(getData, { accountId: '$accountId' })
    wired(result) {
        this.wiredResult = result;
        if (result.data) {
            this.data = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = reduceError(result.error);
            this.data = undefined;
        }
        this.buildTree();
    }

    buildTree() {
        this.treeData = this.data ? deliveryTree(this.data, this.atRiskOnly) : [];
        this.expandedRows = expandedIds(this.treeData);
    }

    // ---------------------------------------------------------------- state

    get showPicker() {
        return !this._recordId;
    }

    get pickerReady() {
        return !!this.accountOptions && this.accountOptions.length > 0;
    }

    get pickerEmpty() {
        return !!this.accountOptions && this.accountOptions.length === 0;
    }

    get isLoading() {
        return !!this.accountId && !this.data && !this.error;
    }

    get hasData() {
        return !!this.data && !!this.data.account;
    }

    get account() {
        return this.data.account;
    }

    get roleBadges() {
        return (this.account.Account_Role__c || '').split(';').filter(Boolean);
    }

    // Space the header card from the account picker above it (app page only).
    get headerCardClass() {
        return this.showPicker ? 'slds-show slds-var-m-top_small' : 'slds-show';
    }

    get healthBadgeClass() {
        return healthBadgeClass(this.account.Customer_Health__c);
    }

    get healthLabel() {
        return healthLabel(this.account.Customer_Health__c);
    }

    get subtitle() {
        return [this.account.Customer_Tier__c && `${this.account.Customer_Tier__c} tier`, this.account.Account_Status__c, this.account.Owner?.Name && `Owner: ${this.account.Owner.Name}`]
            .filter(Boolean)
            .join(' · ');
    }

    // ---------------------------------------------------------------- KPIs

    get kpis() {
        return kpiTiles(this.data.kpis);
    }

    // ---------------------------------------------------------------- contracts

    get hasContracts() {
        return this.data.contracts.length > 0;
    }

    // One contract gets the full-width strip layout instead of a lone card in a mostly empty row.
    get contractsClass() {
        return this.data.contracts.length === 1 ? 'contracts contracts_single slds-var-m-top_small' : 'contracts slds-var-m-top_small';
    }

    get contractCards() {
        return this.data.contracts.map(contractCard);
    }

    // ---------------------------------------------------------------- delivery tree

    get hasTreeData() {
        return this.treeData.length > 0;
    }

    get treeEmptyMessage() {
        return this.atRiskOnly ? 'Nothing at risk or overdue.' : 'No contracts or projects on this account yet.';
    }

    handleAtRiskToggle(event) {
        this.atRiskOnly = event.target.checked;
        this.buildTree();
    }

    // ---------------------------------------------------------------- timeline

    get timelineItems() {
        const projectName = new Map(this.data.projects.map((p) => [p.Id, p.Name]));
        return this.data.deliverables
            .filter((del) => del.Status__c !== 'Cancelled')
            .map((del) => ({
                id: del.Id,
                label: del.Name,
                group: projectName.get(del.Project__c) || 'Other',
                start: del.Planned_Start_Date__c,
                end: del.Due_Date__c,
                forecast: del.Forecast_Completion_Date__c,
                health: del.Health__c,
                status: del.Status__c,
                detail: del.Revenue_Milestone__c ? `${money(del.Revenue_Milestone__c)} milestone` : null
            }));
    }

    // ---------------------------------------------------------------- service

    get serviceRows() {
        return this.data.serviceEngagements.map((s) => ({
            id: s.Id,
            url: url(s.Id),
            name: s.Name,
            type: s.Service_Type__c,
            health: s.Health__c,
            casesOpen: s.Cases_Open__c,
            slaBreaches: s.SLA_Breaches__c || 0,
            slaOption: s.SLA_Breaches__c ? 'negative' : 'positive',
            slaLabel: s.SLA_Breaches__c ? 'SLA breached' : 'SLA met',
            nextMilestone: s.Next_Milestone_Date__c
        }));
    }

    get hasService() {
        return this.serviceRows.length > 0;
    }

    get caseRows() {
        return this.data.cases.map((c) => ({
            id: c.Id,
            url: url(c.Id),
            number: c.CaseNumber,
            subject: c.Subject,
            severity: c.Severity__c,
            severityClass: isSevereCase(c.Severity__c) ? 'slds-text-color_error' : '',
            status: c.IsEscalated ? `${c.Status} (escalated)` : c.Status,
            impact: c.Deliverable__r?.Name
        }));
    }

    get hasCases() {
        return this.caseRows.length > 0;
    }

    // ---------------------------------------------------------------- actions

    handleAccountPicked(event) {
        this.accountId = event.detail.value;
        this.data = undefined;
        this.error = undefined;
        this.buildTree();
    }

    handleRefresh() {
        return refreshApex(this.wiredResult);
    }

    // ---------------------------------------------------------------- live updates (Change Data Capture)

    connectedCallback() {
        this.disconnected = false;
        // The account list is for the app page only; a record page already has its account.
        if (!this._recordId) {
            getPickerAccounts()
                .then((options) => {
                    this.accountOptions = options;
                })
                .catch((e) => {
                    this.accountOptions = [];
                    this.error = reduceError(e);
                });
        }
        subscribeToDeliveryChanges((batch) => this.handleLiveChanges(batch)).then((sub) => {
            if (this.disconnected) {
                sub.unsubscribe();
                return;
            }
            this.liveSubscription = sub;
            this.live = sub.live;
        });
    }

    disconnectedCallback() {
        this.disconnected = true;
        if (this.liveSubscription) {
            this.liveSubscription.unsubscribe();
            this.liveSubscription = undefined;
        }
    }

    // This account's deliverables or their updates, or one created on (or moved to) this account,
    // one of its projects or deliverables.
    handleLiveChanges(batch) {
        if (!this.data) return;
        const deliverableIds = this.data.deliverables.map((d) => d.Id);
        const ids = new Set([...deliverableIds, ...this.data.updatesAwaitingReview.map((u) => u.Id)]);
        const parentIds = new Set([this.accountId, ...this.data.projects.map((p) => p.Id), ...deliverableIds]);
        if (affects(batch, { ids, parentIds })) {
            refreshApex(this.wiredResult);
        }
    }

    handleOpenAccount() {
        this.navigateToRecord(this.accountId);
    }

    handleNewRisk() {
        this.navigateToNew('Risk__c', { Account__c: this.accountId });
    }

    handleNewCase() {
        this.navigateToNew('Case', { AccountId: this.accountId });
    }

    navigateToRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, actionName: 'view' }
        });
    }

    navigateToNew(objectApiName, defaults) {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName, actionName: 'new' },
            state: { defaultFieldValues: encodeDefaultFieldValues(defaults) }
        });
    }
}
