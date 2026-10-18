// Helpers shared by the Account Command Center and the account section components placed
// alongside it (accountSupplierUpdates, accountSuppliers, accountTeam).

export { recordUrl as url, reduceError } from 'c/denaliFormat';

// Salesforce percent fields hold 40 for 40%; lightning-datatable's percent type expects 0.4.
export const pct = (v) => (v === null || v === undefined ? null : v / 100);
