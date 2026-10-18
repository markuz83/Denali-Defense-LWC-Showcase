// How the desktop and mobile Account Command Centers turn getData's results into what they
// show. Both map the data with these functions, so the two layouts can't drift apart.
import { LOCALE, money, daysUntil, recordUrl } from 'c/denaliFormat';
import { pct } from 'c/accountSectionUtils';

const PERCENT = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 });
const plural = (n, word, suffix = 's') => `${n} ${word}${n === 1 ? '' : suffix}`;
const isBlank = (v) => v === null || v === undefined;
// Percent fields hold 40 for 40%.
const fieldPct = (v) => PERCENT.format(v / 100);

/** Badge class for the account's Customer Health. */
export function healthBadgeClass(health) {
    if (health === 'Red') return 'slds-theme_error';
    if (health === 'Yellow') return 'slds-theme_warning';
    if (health === 'Green') return 'slds-theme_success';
    return '';
}

export function healthLabel(health) {
    return health ? `Health: ${health}` : 'Health not set';
}

/** KPI tiles from getData's kpis, keyed: acv, backlog, accepted, risk, risks, cases, updates. */
export function kpiTiles(k) {
    return [
        { key: 'acv', label: 'Active Contract Value', value: money(k.activeContractValue), sub: 'Activated contracts' },
        { key: 'backlog', label: 'Backlog', value: money(k.backlog), sub: 'Not yet recognized' },
        { key: 'accepted', label: 'Revenue Accepted', value: money(k.revenueAccepted), sub: 'Milestones accepted' },
        {
            key: 'risk',
            label: 'Revenue at Risk',
            value: money(k.revenueAtRisk),
            sub: plural(k.atRiskDeliverables, 'at-risk deliverable'),
            alert: k.revenueAtRisk > 0
        },
        { key: 'risks', label: 'Open Risks', value: String(k.openRisks), sub: `${k.highRisks} high or critical`, alert: k.highRisks > 0 },
        { key: 'cases', label: 'Open Cases', value: String(k.openCases), sub: `${k.severeCases} Sev 1/2`, alert: k.severeCases > 0 },
        {
            key: 'updates',
            label: 'Updates to Review',
            value: String(k.updatesAwaitingReview),
            sub: plural(k.overdueDeliverables, 'overdue deliverable'),
            alert: k.overdueDeliverables > 0
        }
    ].map((t) => ({ ...t, className: t.alert ? 'kpi kpi-alert' : 'kpi' }));
}

/** The next option decision on an activated contract: { label, className }, or a null label. */
export function optionDecision(contract) {
    const days = contract.Status === 'Activated' ? daysUntil(contract.Next_Option_Date__c) : null;
    if (days === null) return { label: null, className: '' };
    if (days < 0) return { label: 'Option date passed', className: 'slds-theme_shade' };
    const className = days <= 60 ? 'slds-theme_error' : days <= 120 ? 'slds-theme_warning' : 'slds-theme_success';
    return { label: `Option decision in ${plural(days, 'day')}`, className };
}

/**
 * A contract card: value split into recognized, funded but not yet recognized, and unfunded
 * (as bar widths), margin at award against forecast, and the next option decision. subtitle
 * leads with the contract number; shortSubtitle (for phones) leaves it out.
 */
export function contractCard(c) {
    const value = c.Contract_Value__c || 0;
    const recognized = Math.min(c.Revenue_Recognized__c || 0, value);
    const fundedOpen = Math.max(Math.min(c.Funded_Value__c || 0, value) - recognized, 0);
    const share = (v) => (value ? Math.round((v / value) * 1000) / 10 : 0);
    const variance = c.Margin_Variance__c;
    const hasMargin = !isBlank(c.Original_Margin__c);
    const option = optionDecision(c);
    return {
        id: c.Id,
        url: recordUrl(c.Id),
        title: c.Award_Number__c || c.ContractNumber,
        subtitle: [c.ContractNumber, c.Contract_Type__c, c.Current_Period__c].filter(Boolean).join(' · '),
        shortSubtitle: [c.Contract_Type__c, c.Current_Period__c].filter(Boolean).join(' · '),
        status: c.Status,
        statusClass: c.Status === 'Activated' ? 'slds-theme_success' : '',
        value: money(value),
        recognized: money(recognized),
        fundedOpen: money(fundedOpen),
        unfunded: money(value - recognized - fundedOpen),
        recognizedStyle: `width:${share(recognized)}%`,
        fundedStyle: `width:${share(fundedOpen)}%`,
        hasMargin,
        marginText: hasMargin
            ? `Margin ${fieldPct(c.Original_Margin__c)} at award → ${isBlank(c.Current_Margin__c) ? '—' : fieldPct(c.Current_Margin__c)} forecast`
            : '',
        hasVariance: !isBlank(variance),
        varianceText: isBlank(variance) ? '' : ` (${variance >= 0 ? '+' : ''}${Number(variance).toFixed(1)} pts)`,
        varianceClass: variance < 0 ? 'slds-text-color_error' : 'slds-text-color_success',
        optionLabel: option.label,
        optionClass: option.className
    };
}

/** "00001234 · Subject", leaving out whichever part is missing. */
export function caseTitle(c) {
    return [c.CaseNumber, c.Subject].filter(Boolean).join(' · ');
}

export const isSevereCase = (severity) => /^Sev [12]/.test(severity || '');

// Solid colored circles for the tree grid, which can't use custom cell types (the Service table
// uses c-health-datatable instead). Datatable cells can't take component CSS, so a character is
// the simplest way to get a filled shape there. Screen readers announce "green circle" etc.
const HEALTH_DOT = {
    Green: '\u{1F7E2}',
    Yellow: '\u{1F7E1}',
    Red: '\u{1F534}'
};
const healthDot = (h) => HEALTH_DOT[h] || h;

/**
 * The desktop's contract -> project -> deliverable tree for lightning-tree-grid. With
 * atRiskOnly, only at-risk or overdue deliverables, and the projects and contracts above
 * them (plus Red projects), are kept.
 */
export function deliveryTree(d, atRiskOnly) {
    const delByProject = new Map();
    d.deliverables.forEach((del) => {
        if (!delByProject.has(del.Project__c)) delByProject.set(del.Project__c, []);
        delByProject.get(del.Project__c).push(del);
    });

    const deliverableRow = (del) => {
        const flags = [];
        if (del.Is_At_Risk__c) flags.push('At risk');
        if (del.Is_Overdue__c) flags.push('Overdue');
        if (del.Requires_Customer_Action__c) flags.push('Customer action');
        if (del.Acceptance_Status__c && del.Acceptance_Status__c !== 'Not Submitted') flags.push(del.Acceptance_Status__c);
        return {
            id: del.Id,
            url: recordUrl(del.Id),
            name: del.Name,
            kind: 'Deliverable',
            status: del.Status__c,
            health: healthDot(del.Health__c),
            pct: pct(del.Percent_Complete__c),
            due: del.Due_Date__c,
            forecast: del.Forecast_Completion_Date__c,
            slip: del.Schedule_Variance_Days__c || null,
            slipClass: del.Schedule_Variance_Days__c > 0 ? 'slds-text-color_error' : '',
            revenue: del.Revenue_Milestone__c,
            flags: flags.join(', '),
            attention: del.Is_At_Risk__c || del.Is_Overdue__c
        };
    };

    const projectRow = (p) => {
        let children = (delByProject.get(p.Id) || []).map(deliverableRow);
        if (atRiskOnly) children = children.filter((c) => c.attention);
        const flags = [];
        if (p.Margin_Erosion__c < 0) flags.push(`Margin ${Number(p.Margin_Erosion__c).toFixed(1)} pts`);
        if (p.Project_Manager__r?.Name) flags.push(`PM: ${p.Project_Manager__r.Name}`);
        const row = {
            id: p.Id,
            url: recordUrl(p.Id),
            name: p.Name,
            kind: 'Project',
            status: p.Status__c,
            health: healthDot(p.Health__c),
            pct: pct(p.Percent_Complete__c),
            due: p.Target_End_Date__c,
            revenue: p.Revenue_Allocation__c,
            flags: flags.join(', '),
            attention: p.Health__c === 'Red' || children.length > 0
        };
        if (children.length) row._children = children;
        return row;
    };

    const projByContract = new Map();
    d.projects.forEach((p) => {
        if (!projByContract.has(p.Contract__c)) projByContract.set(p.Contract__c, []);
        projByContract.get(p.Contract__c).push(p);
    });

    const rows = [];
    const contractIds = new Set();
    d.contracts.forEach((c) => {
        contractIds.add(c.Id);
        let children = (projByContract.get(c.Id) || []).map(projectRow);
        if (atRiskOnly) children = children.filter((p) => p.attention);
        if (atRiskOnly && !children.length) return;
        const row = {
            id: c.Id,
            url: recordUrl(c.Id),
            name: c.Award_Number__c || c.ContractNumber,
            kind: 'Contract',
            status: c.Status,
            health: healthDot(c.Contract_Health__c),
            due: c.EndDate,
            revenue: c.Contract_Value__c,
            flags: c.Current_Period__c || ''
        };
        if (children.length) row._children = children;
        rows.push(row);
    });
    // Projects whose contract belongs to another account still show, at the top level.
    d.projects
        .filter((p) => !contractIds.has(p.Contract__c))
        .map(projectRow)
        .filter((p) => !atRiskOnly || p.attention)
        .forEach((p) => rows.push(p));
    return rows;
}

/** Ids of every row with children, so the tree grid opens fully expanded. */
export function expandedIds(rows) {
    const ids = [];
    const walk = (list) =>
        list.forEach((r) => {
            if (r._children) {
                ids.push(r.id);
                walk(r._children);
            }
        });
    walk(rows);
    return ids;
}
