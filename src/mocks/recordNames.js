import { getState } from './apexHandlers.js';
import { USERS } from './denaliData.js';

const COLLECTIONS = [
    ['accounts', 'Account'], ['contracts', 'Contract'], ['projects', 'Project'], ['deliverables', 'Deliverable'],
    ['deliverableUpdates', 'Deliverable Update'], ['serviceEngagements', 'Service Engagement'], ['cases', 'Case'],
    ['risks', 'Risk'], ['opportunities', 'Opportunity'], ['supplierAssignments', 'Supplier Assignment'],
    ['projectResources', 'Project Resource']
];

export function findRecord(id) {
    const state = getState();
    for (const [key] of COLLECTIONS) {
        const hit = state[key].find((r) => r.Id === id);
        if (hit) return hit;
    }
    return null;
}

/** "Opportunity “Aegis - Zero Trust Production (FFP)”", for navigation toasts. */
export function describeRecord(id) {
    const state = getState();
    for (const [key, label] of COLLECTIONS) {
        const r = state[key].find((x) => x.Id === id);
        if (r) {
            const name = r.Name || r.Subject || r.CaseNumber || r.Award_Number__c || r.ContractNumber;
            return `${label} “${name}”`;
        }
    }
    const h = state.headToHead.find((x) => x.id === id);
    if (h) return `Opportunity “${h.name}”`;
    const u = USERS.find((x) => x.Id === id);
    if (u) return `User “${u.Name}”`;
    return `record ${id}`;
}
