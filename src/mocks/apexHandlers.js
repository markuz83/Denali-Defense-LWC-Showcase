/**
 * In-browser stand-ins for the org kit's Apex controllers. Each handler takes the same
 * parameters as the @AuraEnabled method and returns the same shape, read from the sample
 * state in denaliData.js. Methods that change data (reviews, approvals) change that state,
 * so refreshApex shows the result just as it would in the org.
 */
import { buildState, sfId, ME, USERS, isoDateTime, withDeliverableFormulas, iso } from './denaliData.js';

let state = buildState();
const changeListeners = new Set();

export function resetState() {
    state = buildState();
    changeListeners.forEach((fn) => fn());
}

/** Called after any change to the sample data (used to refresh every wired component). */
export function onStateChange(fn) {
    changeListeners.add(fn);
    return () => changeListeners.delete(fn);
}

function changed() {
    changeListeners.forEach((fn) => fn());
}

export function getState() {
    return state;
}

export function auraError(message) {
    const e = new Error(message);
    e.body = { message };
    return e;
}

const PENDING_REVIEW = new Set(['Pending', 'Under Review']);
const CLOSED_RISK = new Set(['Closed', 'Realized']);
const byId = (list, id) => list.find((r) => r.Id === id);
const nz = (v) => v || 0;
const projectIdsFor = (accountId) => state.projects.filter((p) => p.Account__c === accountId).map((p) => p.Id);
const deliverableProjectId = (deliverableId) => byId(state.deliverables, deliverableId)?.Project__c;

function updatesAwaitingReview(accountId) {
    const projectIds = new Set(projectIdsFor(accountId));
    return state.deliverableUpdates
        .filter((u) => PENDING_REVIEW.has(u.Internal_Review_Status__c) && projectIds.has(deliverableProjectId(u.Deliverable__c)))
        .sort((a, b) => b.Submitted_Date__c.localeCompare(a.Submitted_Date__c));
}

function opportunityView(o) {
    return o && { ...o };
}

export const handlers = {
    // ---------------------------------------------------------------- AccountCommandCenterController
    'AccountCommandCenterController.getData'({ accountId }) {
        if (!accountId) return null;
        const account = byId(state.accounts, accountId);
        if (!account) return null;
        const projectIds = new Set(projectIdsFor(accountId));
        const d = {
            account,
            contracts: state.contracts.filter((k) => k.AccountId === accountId),
            projects: state.projects.filter((p) => p.Account__c === accountId),
            deliverables: state.deliverables
                .filter((x) => projectIds.has(x.Project__c))
                .sort((a, b) => (a.Due_Date__c || '9').localeCompare(b.Due_Date__c || '9')),
            risks: state.risks
                .filter((r) => r.Account__c === accountId && !CLOSED_RISK.has(r.Status__c))
                .sort((a, b) => nz(b.Risk_Score__c) - nz(a.Risk_Score__c)),
            cases: state.cases.filter((c) => c.AccountId === accountId && !c.IsClosed),
            serviceEngagements: state.serviceEngagements.filter((s) => s.Account__c === accountId),
            updatesAwaitingReview: updatesAwaitingReview(accountId)
        };
        const k = {
            activeContractValue: 0, backlog: 0, revenueAccepted: 0, revenueAtRisk: 0, atRiskDeliverables: 0,
            overdueDeliverables: 0, openRisks: d.risks.length, highRisks: 0, openCases: d.cases.length, severeCases: 0,
            updatesAwaitingReview: d.updatesAwaitingReview.length
        };
        d.contracts.filter((c) => c.Status === 'Activated').forEach((c) => {
            k.activeContractValue += nz(c.Contract_Value__c);
            k.backlog += nz(c.Total_Backlog__c);
        });
        d.deliverables.forEach((x) => {
            if (x.Acceptance_Status__c === 'Accepted') k.revenueAccepted += nz(x.Revenue_Milestone__c);
            if (x.Is_At_Risk__c) {
                k.atRiskDeliverables++;
                k.revenueAtRisk += nz(x.Revenue_Milestone__c);
            }
            if (x.Is_Overdue__c) k.overdueDeliverables++;
        });
        d.risks.forEach((r) => {
            if (r.Severity__c === 'High' || r.Severity__c === 'Critical') k.highRisks++;
        });
        d.cases.forEach((c) => {
            if (c.Severity__c?.startsWith('Sev 1') || c.Severity__c?.startsWith('Sev 2')) k.severeCases++;
        });
        d.kpis = k;
        return d;
    },

    'AccountCommandCenterController.getPickerAccounts'() {
        return state.accounts
            .filter((a) => a.Is_Customer__c && a.Account_Status__c === 'Active')
            .map((a) => {
                const awards = state.contracts.filter((k) => k.AccountId === a.Id && k.Status === 'Activated').map((k) => k.Award_Number__c);
                return { label: awards.length ? `${a.Name} - ${awards.join(', ')}` : a.Name, value: a.Id };
            });
    },

    'AccountCommandCenterController.getUpdatesAwaitingReview'({ accountId }) {
        return accountId ? updatesAwaitingReview(accountId) : [];
    },

    'AccountCommandCenterController.getSuppliers'({ accountId }) {
        return state.supplierAssignments.filter((s) => s.Account__c === accountId);
    },

    'AccountCommandCenterController.getTeam'({ accountId }) {
        return state.projectResources
            .filter((r) => r.Account__c === accountId && r.Resource_Status__c !== 'Rolled Off')
            .sort((a, b) => a.Employee__r.Name.localeCompare(b.Employee__r.Name));
    },

    // ---------------------------------------------------------------- CompetitorIntelController
    'CompetitorIntelController.getIntel'({ recordId }) {
        const opp = byId(state.opportunities, recordId);
        const competitorId = opp ? opp.Incumbent__c : recordId === state.competitorId ? recordId : null;
        if (!competitorId) return null;
        const intel = {
            competitorId, competitorName: byId(state.accounts, competitorId).Name, wins: 0, losses: 0, bookingsWon: 0,
            bookingsLost: 0, avgMarginWon: null, avgMarginLost: null, openDeals: 0, openPipeline: 0, lossReasons: [], recent: []
        };
        const won = [];
        const lost = [];
        const reasons = new Map();
        state.headToHead.forEach((h) => {
            if (h.won) {
                intel.wins++;
                intel.bookingsWon += h.amount;
                won.push(h.margin);
            } else {
                intel.losses++;
                intel.bookingsLost += h.amount;
                lost.push(h.margin);
                const reason = h.lossReason || 'Not recorded';
                const rc = reasons.get(reason) || { reason, count: 0, amount: 0 };
                rc.count++;
                rc.amount += h.amount;
                reasons.set(reason, rc);
            }
            if (intel.recent.length < 6) intel.recent.push(h);
        });
        state.opportunities.filter((o) => o.Incumbent__c === competitorId && !o.IsClosed).forEach((o) => {
            intel.openDeals++;
            intel.openPipeline += nz(o.Amount);
        });
        const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
        intel.avgMarginWon = avg(won);
        intel.avgMarginLost = avg(lost);
        intel.lossReasons = [...reasons.values()];
        if (opp && !opp.IsClosed) {
            intel.pursuitMargin = opp.Estimated_Margin__c;
            intel.pursuitFloor = opp.Margin_Floor__c;
        }
        return intel;
    },

    // ---------------------------------------------------------------- ContractHealthController
    'ContractHealthController.getHealth'({ contractId }) {
        const contract = byId(state.contracts, contractId);
        if (!contract) return null;
        const h = {
            contract, projects: state.projects.filter((p) => p.Contract__c === contractId), deliverables: 0, deliverablesComplete: 0,
            deliverablesAtRisk: 0, deliverablesOverdue: 0, revenueAtRisk: 0, revenueAwaitingAcceptance: 0, openRisks: 0, highRisks: 0, openCases: 0
        };
        state.deliverables.filter((d) => d.Contract__c === contractId).forEach((d) => {
            h.deliverables++;
            if (d.Status__c === 'Complete') h.deliverablesComplete++;
            if (d.Is_At_Risk__c) {
                h.deliverablesAtRisk++;
                h.revenueAtRisk += nz(d.Revenue_Milestone__c);
            }
            if (d.Is_Overdue__c) h.deliverablesOverdue++;
            if (d.Acceptance_Status__c !== 'Accepted' && d.Status__c !== 'Cancelled') h.revenueAwaitingAcceptance += nz(d.Revenue_Milestone__c);
        });
        state.risks.filter((r) => r.Contract__c === contractId && !CLOSED_RISK.has(r.Status__c)).forEach((r) => {
            h.openRisks++;
            if (r.Severity__c === 'High' || r.Severity__c === 'Critical') h.highRisks++;
        });
        const engagementIds = new Set(state.serviceEngagements.filter((s) => s.Contract__c === contractId).map((s) => s.Id));
        const projectIds = new Set(h.projects.map((p) => p.Id));
        h.openCases = state.cases.filter((c) => !c.IsClosed && (projectIds.has(c.Project__c) || engagementIds.has(c.Service_Engagement__c))).length;
        return h;
    },

    // ---------------------------------------------------------------- ImpactChainController
    'ImpactChainController.getChain'({ caseId }) {
        const caseRecord = byId(state.cases, caseId);
        if (!caseRecord) return null;
        const ch = { caseRecord, risks: [] };
        if (caseRecord.Deliverable__c) ch.deliverable = byId(state.deliverables, caseRecord.Deliverable__c);
        const projectId = ch.deliverable ? ch.deliverable.Project__c : caseRecord.Project__c;
        if (projectId) {
            ch.project = byId(state.projects, projectId);
            ch.contract = byId(state.contracts, ch.project.Contract__c);
        }
        if (caseRecord.Service_Engagement__c) {
            ch.serviceEngagement = byId(state.serviceEngagements, caseRecord.Service_Engagement__c);
            if (!ch.contract && ch.serviceEngagement.Contract__c) ch.contract = byId(state.contracts, ch.serviceEngagement.Contract__c);
        }
        const open = state.risks.filter((r) => !CLOSED_RISK.has(r.Status__c));
        if (ch.deliverable || projectId) {
            ch.risks = open.filter((r) => r.Deliverable__c === ch.deliverable?.Id || (r.Project__c === projectId && !r.Deliverable__c));
        } else if (ch.contract) {
            ch.risks = open.filter((r) => r.Contract__c === ch.contract.Id);
        }
        ch.risks = ch.risks.sort((a, b) => nz(b.Risk_Score__c) - nz(a.Risk_Score__c)).slice(0, 5);
        if (ch.deliverable && ch.deliverable.Acceptance_Status__c !== 'Accepted') ch.revenueAtStake = ch.deliverable.Revenue_Milestone__c;
        return ch;
    },

    // ---------------------------------------------------------------- MarginGuardrailController
    'MarginGuardrailController.getContext'({ opportunityId }) {
        const opportunity = byId(state.opportunities, opportunityId);
        if (!opportunity) return null;
        const pending = state.approvals.find((a) => a.opportunityId === opportunityId);
        const sameType = state.headToHead.filter((h) => h.won);
        return {
            opportunity: opportunityView(opportunity),
            avgWonMarginSameType: 13.5,
            wonCountSameType: sameType.length,
            avgWonMarginAll: 15.2,
            wonCountAll: 11,
            pendingApproval: !!pending,
            pendingApproverName: pending ? USERS.find((u) => u.Id === pending.approverId)?.Name : undefined,
            submittedDate: pending?.submittedDate
        };
    },

    'MarginGuardrailController.submitForApproval'({ opportunityId, approverId, comments }) {
        if (!approverId) throw auraError('Choose who should review the pricing.');
        const opp = byId(state.opportunities, opportunityId);
        if (!opp.Below_Margin_Floor__c) throw auraError('No applicable approval process was found.');
        if (state.approvals.some((a) => a.opportunityId === opportunityId)) throw auraError('This record is already in an approval process.');
        state.approvals.push({
            workitemId: sfId('04i', `${opportunityId}-${Date.now()}`), recordId: opp.Id, recordName: opp.Name, objectType: 'Opportunity',
            submittedBy: ME.Name, submittedDate: new Date().toISOString(), opportunityId, approverId, comments
        });
        opp.Margin_Approval_Status__c = 'Pending';
        opp.LastModifiedDate = new Date().toISOString();
        changed();
    },

    'MarginGuardrailController.regenerateRationale'({ opportunityId }) {
        const o = byId(state.opportunities, opportunityId);
        if (o.Margin_Approval_Status__c === 'Pending') {
            throw auraError('The record is locked while its pricing approval is pending.');
        }
        const gap = (o.Margin_Floor__c - o.Estimated_Margin__c).toFixed(1);
        const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(o.Amount);
        o.Pricing_Rationale__c =
            `Summary: ${o.Name} is priced at ${o.Estimated_Margin__c}% on ${amount}, ` +
            (o.Below_Margin_Floor__c ? `${gap} points under the ${o.Margin_Floor__c}% ${o.Contract_Type__c} floor.\n` : `at or above the ${o.Margin_Floor__c}% floor.\n`) +
            (o.Incumbent__r
                ? `Competition: ${o.Incumbent__r.Name} is the incumbent and has beaten us on price in recent bids; our wins against them averaged 13.5% margin, our losses 18%.\n`
                : '') +
            'Recommendation: Hold the price to win the base period, and recover margin in the option years through labor-mix changes.';
        o.LastModifiedDate = new Date().toISOString();
        changed();
        return o.Pricing_Rationale__c;
    },

    // ---------------------------------------------------------------- MyProjectsController
    'MyProjectsController.getMyWork'() {
        const dueBy = iso(new Date(Date.now() + 30 * 86400000));
        const active = state.projects.filter((p) => !['Complete', 'Cancelled'].includes(p.Status__c));
        const byProject = new Map();
        const w = { projects: [], updatesToReview: [], dueSoon: [], risks: [] };
        active
            .slice()
            .sort((a, b) => (a.Target_End_Date__c || '9').localeCompare(b.Target_End_Date__c || '9'))
            .forEach((p) => {
                const project = {
                    ...p,
                    Account__r: { Name: byId(state.accounts, p.Account__c).Name },
                    Contract__r: { Award_Number__c: byId(state.contracts, p.Contract__c)?.Award_Number__c }
                };
                const s = { project, deliverables: 0, complete: 0, atRisk: 0, overdue: 0, dueSoon: 0, updatesToReview: 0, revenueAtRisk: 0 };
                byProject.set(p.Id, s);
                w.projects.push(s);
            });
        state.deliverables
            .filter((d) => byProject.has(d.Project__c))
            .sort((a, b) => (a.Due_Date__c || '9').localeCompare(b.Due_Date__c || '9'))
            .forEach((d) => {
                const s = byProject.get(d.Project__c);
                s.deliverables++;
                if (d.Status__c === 'Complete') s.complete++;
                if (d.Is_At_Risk__c) {
                    s.atRisk++;
                    s.revenueAtRisk += nz(d.Revenue_Milestone__c);
                }
                if (d.Is_Overdue__c) s.overdue++;
                const isOpen = !['Complete', 'Cancelled'].includes(d.Status__c);
                if (isOpen && d.Due_Date__c && d.Due_Date__c <= dueBy) {
                    s.dueSoon++;
                    w.dueSoon.push(d);
                }
            });
        w.updatesToReview = state.deliverableUpdates
            .filter((u) => PENDING_REVIEW.has(u.Internal_Review_Status__c) && byProject.has(deliverableProjectId(u.Deliverable__c)))
            .sort((a, b) => a.Submitted_Date__c.localeCompare(b.Submitted_Date__c));
        w.updatesToReview.forEach((u) => byProject.get(deliverableProjectId(u.Deliverable__c)).updatesToReview++);
        w.risks = state.risks
            .filter((r) => !CLOSED_RISK.has(r.Status__c) && (r.Risk_Owner__r?.Name === ME.Name || byProject.has(r.Project__c)))
            .sort((a, b) => nz(b.Risk_Score__c) - nz(a.Risk_Score__c))
            .slice(0, 20);
        return w;
    },

    // ---------------------------------------------------------------- PricingApprovalsController
    'PricingApprovalsController.getMyApprovals'() {
        return state.approvals
            .filter((a) => a.approverId === ME.Id)
            .map((a) => ({ ...a, opportunity: opportunityView(byId(state.opportunities, a.opportunityId)) }));
    },

    'PricingApprovalsController.decide'({ workitemId, action }) {
        if (action !== 'Approve' && action !== 'Reject') throw auraError(`Unknown action: ${action}`);
        const item = state.approvals.find((a) => a.workitemId === workitemId);
        if (!item) throw auraError('This approval request was already decided.');
        state.approvals = state.approvals.filter((a) => a !== item);
        const opp = byId(state.opportunities, item.opportunityId);
        opp.Margin_Approval_Status__c = action === 'Approve' ? 'Approved' : 'Rejected';
        opp.LastModifiedDate = new Date().toISOString();
        changed();
    },

    // ---------------------------------------------------------------- ProjectTimelineController
    'ProjectTimelineController.getDeliverables'({ projectId }) {
        return state.deliverables
            .filter((d) => d.Project__c === projectId && d.Status__c !== 'Cancelled')
            .sort((a, b) => (a.Due_Date__c || '9').localeCompare(b.Due_Date__c || '9'));
    },

    // ---------------------------------------------------------------- SupplierUpdateReviewController
    'SupplierUpdateReviewController.getReview'({ deliverableId }) {
        const deliverable = byId(state.deliverables, deliverableId);
        if (!deliverable) return null;
        return {
            deliverable,
            updates: state.deliverableUpdates
                .filter((u) => u.Deliverable__c === deliverableId)
                .sort((a, b) => b.Submitted_Date__c.localeCompare(a.Submitted_Date__c))
        };
    },

    'SupplierUpdateReviewController.review'({ updateId, decision, comments }) {
        const decisions = ['Under Review', 'Accepted', 'Needs Clarification', 'Rejected'];
        if (!decisions.includes(decision)) throw auraError(`Unknown review decision: ${decision}`);
        if ((decision === 'Needs Clarification' || decision === 'Rejected') && !comments?.trim()) {
            throw auraError('Tell the supplier what needs to change.');
        }
        const u = byId(state.deliverableUpdates, updateId);
        if (u.Internal_Review_Status__c === 'Accepted') throw auraError('Accepted updates are locked and can’t be changed.');
        u.Internal_Review_Status__c = decision;
        if (comments) u.Reviewer_Comments__c = comments;
        if (decision !== 'Under Review') {
            u.Reviewed_By__r = { Name: ME.Name };
            u.Review_Date__c = iso(new Date());
        }
        // Update Review flow (#6): an accepted update moves its Deliverable.
        if (decision === 'Accepted') {
            const d = byId(state.deliverables, u.Deliverable__c);
            d.Percent_Complete__c = u.Percent_Complete__c;
            d.Forecast_Completion_Date__c = u.Forecast_Completion_Date__c;
            if (u.Supplier_Health__c) d.Health__c = u.Supplier_Health__c;
            if (u.Reported_Status__c) d.Status__c = u.Reported_Status__c;
            d.Latest_Update_Date__c = iso(new Date());
            withDeliverableFormulas(d);
        }
        changed();
    }
};

/**
 * A supplier submits a new update on the blocked Sensor Fusion build: what the
 * "Simulate a supplier update" button does, standing in for the Supplier Portal.
 * Returns the change event the org's Change Data Capture would publish.
 */
export function simulateSupplierUpdate() {
    const del = state.deliverables.find((d) => d.Name === 'Sensor Fusion Software Build 2.0');
    const n = ++state.updateSeq;
    const u = {
        Id: sfId('a04', `sim-${n}`), Name: `DU-${String(n).padStart(5, '0')}`, Deliverable__c: del.Id,
        Deliverable__r: { Name: del.Name, Project__c: del.Project__c }, Supplier__r: { Name: 'Ironbridge Systems' },
        Submitted_By__r: { Name: 'Luis Ortega' }, Submitted_Date__c: isoDateTime(0, new Date().getHours()),
        Reported_Status__c: 'In Progress', Percent_Complete__c: 65 + Math.min(n, 6) * 5,
        Forecast_Completion_Date__c: del.Forecast_Completion_Date__c, Supplier_Health__c: 'Yellow',
        Progress_Summary__c: 'GFI test data received; integration testing restarted.',
        Next_Steps__c: 'Finish legacy feed adapter and rerun the field test.', Internal_Review_Status__c: 'Pending'
    };
    state.deliverableUpdates.push(u);
    return { entityName: 'Deliverable_Update__c', changeType: 'CREATE', recordIds: [u.Id] };
}
