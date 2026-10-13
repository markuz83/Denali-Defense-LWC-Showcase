/**
 * The Denali Defense components on show, one tab each. Read by routes.config.js (a route and
 * tab per entry) and page-showcase (what to render and with which sample records).
 *
 * Fields:
 *   id          - nav page id, and the route path (/<id>)
 *   component   - the LWC under src/modules/c (copied unchanged from the org kit's force-app)
 *   label       - tab label
 *   placement   - where it goes in Salesforce
 *   summary     - one or two sentences for the page header
 *   tryIt       - things to try, shown above the component
 *   width       - 'full' (main column), 'main' (two-thirds column), 'sidebar' (record page sidebar), 'phone'
 *   live        - subscribes to Change Data Capture; the page offers "Simulate a supplier update"
 *   examples    - sample records to switch between: { label, props } (props may be a function of the sample data)
 */
import { sfId } from './mocks/denaliData.js';
import { handlers, getState } from './mocks/apexHandlers.js';

const account = (key) => sfId('001', key);
const money = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);

// The same mapping accountCommandCenter uses for its timeline.
function timelineItems(accountKey) {
    const d = handlers['AccountCommandCenterController.getData']({ accountId: account(accountKey) });
    const projectName = new Map(d.projects.map((p) => [p.Id, p.Name]));
    return d.deliverables.map((del) => ({
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

const openRisks = (accountKey) => handlers['AccountCommandCenterController.getData']({ accountId: account(accountKey) }).risks;

const HEALTH_TABLE_COLUMNS = [
    { type: 'text', fieldName: 'name', label: 'Engagement' },
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

function healthTable() {
    const s = getState();
    const projects = s.projects.map((p) => ({
        id: p.Id, name: p.Name, health: p.Health__c, casesOpen: s.cases.filter((c) => c.Project__c === p.Id && !c.IsClosed).length,
        slaBreaches: 0, slaOption: 'positive', slaLabel: 'No SLA breaches', nextMilestone: p.Target_End_Date__c
    }));
    const engagements = s.serviceEngagements.map((e) => ({
        id: e.Id, name: e.Name, health: e.Health__c, casesOpen: e.Cases_Open__c, slaBreaches: e.SLA_Breaches__c,
        slaOption: e.SLA_Breaches__c ? 'negative' : 'positive', slaLabel: e.SLA_Breaches__c ? 'SLA breached' : 'No SLA breaches',
        nextMilestone: e.Next_Milestone_Date__c
    }));
    return { keyField: 'id', columns: HEALTH_TABLE_COLUMNS, data: [...engagements, ...projects], hideCheckboxColumn: true };
}

export const showcase = [
    {
        id: 'account-command-center',
        component: 'accountCommandCenter',
        label: 'Account Command Center',
        placement: 'Account record page (Command Center tab) and the Denali Portfolio app page',
        summary:
            'Everything happening on one customer in a single view: KPIs, contracts, the project and deliverable tree, a delivery timeline, a risk heat map, service engagements and open cases.',
        tryIt: [
            'Turn on "At-risk only" in the delivery tree.',
            'Switch to "App page" to see the account picker it shows outside a record page.',
            'Simulate a supplier update: the Updates to Review count changes without a reload.'
        ],
        width: 'full',
        live: true,
        examples: [
            { label: 'Northwind Defense Agency', props: { recordId: account('nda') } },
            { label: 'Federal Logistics Command', props: { recordId: account('flc') } },
            { label: 'App page (account picker)', props: {} }
        ]
    },
    {
        id: 'account-command-center-mobile',
        component: 'accountCommandCenterMobile',
        label: 'Command Center (Mobile)',
        placement: 'Denali Portfolio Mobile and Denali Delivery Mobile apps (phone)',
        summary: 'The Command Center rebuilt for a phone: stacked KPI tiles and tap-to-open lists instead of the tree grid and charts.',
        tryIt: ['Tap a deliverable or case: on a phone it opens the record.', 'Switch to "App page" for the account picker.'],
        width: 'phone',
        examples: [
            { label: 'Northwind Defense Agency', props: { recordId: account('nda') } },
            { label: 'Federal Logistics Command', props: { recordId: account('flc') } },
            { label: 'App page (account picker)', props: {} }
        ]
    },
    {
        id: 'my-projects',
        component: 'myProjects',
        label: 'My Projects',
        placement: 'Denali Delivery home page',
        summary:
            "A project manager's day: their active projects with delivery health, supplier updates waiting on review, deliverables due in the next 30 days, and open risks.",
        tryIt: ['Simulate a supplier update and watch "Updates to review" change on its own.'],
        width: 'full',
        live: true,
        examples: [{ label: 'Project manager (Jordan Ellis)', props: {} }]
    },
    {
        id: 'supplier-update-review',
        component: 'supplierUpdateReview',
        label: 'Supplier Update Review',
        placement: 'Deliverable record page',
        summary:
            "A deliverable's supplier updates, newest first, with the trend in percent complete and an inline review: accept, send back for clarification, or reject.",
        tryIt: [
            'On Sensor Fusion Software Build 2.0, the latest update reports 60% → 60%: no progress. Send it back with Needs Clarification.',
            'Accept an update: the deliverable takes its percent complete, forecast and health.'
        ],
        width: 'main',
        live: true,
        examples: [
            { label: 'Sensor Fusion Software Build 2.0', props: { recordId: sfId('a03', 'software') } },
            { label: 'Ground Station Hardware Kit (x12)', props: { recordId: sfId('a03', 'hardware') } },
            { label: 'Technical Manual Set', props: { recordId: sfId('a03', 'manual') } }
        ]
    },
    {
        id: 'margin-guardrail',
        component: 'marginGuardrail',
        label: 'Margin Guardrail',
        placement: 'Opportunity record page (sidebar)',
        summary:
            "Where a deal's margin sits against its contract-type floor and recent wins, the profit given up, the Margin Exception approval, and an Einstein-drafted pricing rationale.",
        tryIt: [
            'On Zero Trust Production, regenerate the rationale, then submit it for pricing review (choose yourself, Jordan Ellis, to approve it on the Pricing Approvals tab).',
            'Prototype (OTA) is already waiting on approval; Option Year 2 is above its floor.'
        ],
        width: 'sidebar',
        examples: [
            { label: 'Aegis - Zero Trust Production (FFP)', props: { recordId: sfId('006', 'zt') } },
            { label: 'Aegis - Zero Trust Prototype (OTA)', props: { recordId: sfId('006', 'ota') } },
            { label: 'FLC - Network Ops Option Year 2', props: { recordId: sfId('006', 'flcopt') } }
        ]
    },
    {
        id: 'pricing-approvals',
        component: 'pricingApprovals',
        label: 'Pricing Approvals',
        placement: 'Denali Portfolio home page, and the first tab of Denali Portfolio Mobile',
        summary: 'Margin Exception requests waiting on you, with the pricing facts a reviewer needs and approve or reject in place.',
        tryIt: ['Approve or reject the request. Submit another from the Margin Guardrail tab.'],
        width: 'main',
        examples: [{ label: 'General manager (Jordan Ellis)', props: {} }]
    },
    {
        id: 'competitor-intel',
        component: 'competitorIntel',
        label: 'Competitor Intel',
        placement: 'Opportunity record page (the incumbent) and competitor Account record page',
        summary:
            'Head-to-head history against a competitor over three years: win rate, bookings won and lost, average margin on wins versus losses, loss reasons, and recent deals.',
        width: 'sidebar',
        examples: [
            { label: 'Opportunity: Aegis - Zero Trust Production (FFP)', props: { recordId: sfId('006', 'zt') } },
            { label: 'Competitor account: Vantage Federal', props: { recordId: account('vantage') } }
        ]
    },
    {
        id: 'contract-health',
        component: 'contractHealth',
        label: 'Contract Health',
        placement: 'Contract record page',
        summary:
            'Funding and revenue recognition, margin at award against forecast, the next option decision, and what is at risk underneath: projects, deliverables, risks and cases.',
        width: 'main',
        examples: [
            { label: 'NDA-2026-001 (Northwind)', props: { recordId: sfId('800', 'nda') } },
            { label: 'FLC-2025-014 (Federal Logistics)', props: { recordId: sfId('800', 'flc') } }
        ]
    },
    {
        id: 'impact-chain',
        component: 'impactChain',
        label: 'Impact Chain',
        placement: 'Case record page (sidebar)',
        summary:
            'What a support case touches upstream: the deliverable, its project and contract, the revenue milestone at stake, and the open risks already logged.',
        width: 'sidebar',
        examples: [
            { label: 'Fusion build crashes on legacy sensor feed', props: { recordId: sfId('500', 'fusion') } },
            { label: 'Core router outage at Denver depot', props: { recordId: sfId('500', 'router') } }
        ]
    },
    {
        id: 'project-timeline',
        component: 'projectTimeline',
        label: 'Project Timeline',
        placement: 'Project record page',
        summary: "A Gantt-style timeline of a project's deliverables. A dashed red line runs from the due date to a later forecast.",
        width: 'full',
        live: true,
        examples: [
            { label: 'Sensor Integration - Phase 1', props: { recordId: sfId('a02', 'sensor') } },
            { label: 'Operator Training & Documentation', props: { recordId: sfId('a02', 'training') } }
        ]
    },
    {
        id: 'account-supplier-updates',
        component: 'accountSupplierUpdates',
        label: 'Supplier Updates',
        placement: 'Account record page (sidebar, next to the Command Center)',
        summary: "Supplier updates on the account's deliverables that are still waiting on internal review.",
        tryIt: ['Simulate a supplier update: the new one appears at the top.'],
        width: 'main',
        live: true,
        examples: [
            { label: 'Northwind Defense Agency', props: { recordId: account('nda') } },
            { label: 'Federal Logistics Command', props: { recordId: account('flc') } }
        ]
    },
    {
        id: 'account-suppliers',
        component: 'accountSuppliers',
        label: 'Suppliers',
        placement: 'Account record page (sidebar)',
        summary: "The suppliers on the account's projects, with their role, status, rating and subcontract value.",
        width: 'main',
        examples: [
            { label: 'Northwind Defense Agency', props: { recordId: account('nda') } },
            { label: 'Federal Logistics Command', props: { recordId: account('flc') } }
        ]
    },
    {
        id: 'account-team',
        component: 'accountTeam',
        label: 'Team',
        placement: 'Account record page (sidebar)',
        summary: "Who's working on the account's projects, in which role, and how much of their time.",
        width: 'main',
        examples: [
            { label: 'Northwind Defense Agency', props: { recordId: account('nda') } },
            { label: 'Federal Logistics Command', props: { recordId: account('flc') } }
        ]
    },
    {
        id: 'timeline',
        component: 'commandCenterTimeline',
        label: 'Timeline',
        placement: 'Inside the Command Center and Project Timeline',
        summary: 'The reusable timeline the Command Center and Project Timeline draw with. It takes a list of dated items and draws itself to its container width.',
        width: 'full',
        examples: [
            { label: 'Northwind deliverables', props: () => ({ title: 'Delivery Timeline', items: timelineItems('nda') }) },
            { label: 'Federal Logistics deliverables', props: () => ({ title: 'Delivery Timeline', items: timelineItems('flc') }) }
        ]
    },
    {
        id: 'risk-heatmap',
        component: 'commandCenterRiskHeatmap',
        label: 'Risk Heat Map',
        placement: 'Inside the Command Center',
        summary: 'A 5 × 5 likelihood-by-consequence grid of open risks. Click a cell to list its risks.',
        width: 'sidebar',
        examples: [
            { label: 'Northwind open risks', props: () => ({ risks: openRisks('nda') }) },
            { label: 'Federal Logistics open risks', props: () => ({ risks: openRisks('flc') }) }
        ]
    },
    {
        id: 'health-datatable',
        component: 'healthDatatable',
        label: 'Health Datatable',
        placement: 'Inside the Command Center (Service table)',
        summary:
            'lightning-datatable extended with two custom column types: "health" shows Green/Yellow/Red as SLDS status icons, and "score" puts an SLDS score icon before a number.',
        width: 'main',
        examples: [{ label: 'Service engagements and projects', props: healthTable }]
    },
    {
        id: 'health-dot',
        component: 'healthDot',
        label: 'Health Dot',
        placement: 'Inside My Projects, Contract Health and the mobile Command Center',
        summary: 'A health picklist value (Green, Yellow, Red) shown as an SLDS status icon with alternative text, so color is never the only signal.',
        width: 'sidebar',
        examples: [
            { label: 'Green', props: { value: 'Green', size: 'small' } },
            { label: 'Yellow', props: { value: 'Yellow', size: 'small' } },
            { label: 'Red', props: { value: 'Red', size: 'small' } },
            { label: 'Not a health value', props: { value: 'On Hold', size: 'small' } }
        ]
    }
];

