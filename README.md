# Denali Defense Lightning Components

The Lightning Web Components from the [Denali Defense demo org kit](https://github.com/markuz83/Denali-Defense-Org-Kit), running outside Salesforce so you can try them without an org. Each component has its own tab in a Lightning-style app.

Denali Defense is a fictional government contractor: three customers (Northwind Defense Agency, Federal Logistics Command, Aegis Program Office), two suppliers and a competitor, Vantage Federal. The components are the ones the org kit deploys, copied unchanged into `src/modules/c/`. They run against sample data in place of the org's Apex.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The app opens on **Overview**, with a card for each component.

## The tabs

| Tab | Component | In Salesforce |
| --- | --- | --- |
| Account Command Center | `c-account-command-center` | Account record page and the Denali Portfolio app page |
| Command Center (Mobile) | `c-account-command-center-mobile` | Denali Portfolio Mobile and Denali Delivery Mobile (phone) |
| My Projects | `c-my-projects` | Denali Delivery home page |
| Supplier Update Review | `c-supplier-update-review` | Deliverable record page |
| Margin Guardrail | `c-margin-guardrail` | Opportunity record page |
| Pricing Approvals | `c-pricing-approvals` | Denali Portfolio home page |
| Competitor Intel | `c-competitor-intel` | Opportunity and competitor Account record pages |
| Contract Health | `c-contract-health` | Contract record page |
| Impact Chain | `c-impact-chain` | Case record page |
| Project Timeline | `c-project-timeline` | Project record page |
| Supplier Updates | `c-account-supplier-updates` | Account record page |
| Suppliers | `c-account-suppliers` | Account record page |
| Team | `c-account-team` | Account record page |
| Timeline | `c-command-center-timeline` | Inside the Command Center and Project Timeline |
| Risk Heat Map | `c-command-center-risk-heatmap` | Inside the Command Center |
| Health Datatable | `c-health-datatable` | Inside the Command Center |
| Health Dot | `c-health-dot` | Inside My Projects, Contract Health and the mobile Command Center |

Each tab says where the component goes in Salesforce and what to try, and lets you switch between sample records. Things that change data work, and the other tabs see the change:

- **Supplier Update Review:** accept an update, send it back, or reject it.
- **Margin Guardrail:** regenerate the pricing rationale, then submit the deal for pricing review. Choose Jordan Ellis as the reviewer and the request appears on **Pricing Approvals**.
- **Pricing Approvals:** approve or reject.
- **Live updates:** tabs with live components have **Simulate a supplier update**. It stands in for a supplier posting through the portal, and the components refresh on their own, as Change Data Capture makes them do in the org.

**Reset sample data** puts everything back. Reloading the page does too, since the sample data lives in memory.

## How it works

The components import Salesforce platform modules that don't exist outside an org. `vite-plugins/salesforce-mocks.js` points those imports at stand-ins in `src/mocks/`:

| Import | Stand-in |
| --- | --- |
| `@salesforce/apex/<Class>.<method>` | `src/mocks/apexHandlers.js`: one function per Apex method, returning the same shape as the `@AuraEnabled` method. Works with `@wire` and when called directly |
| `@salesforce/apex` (`refreshApex`) | `src/mocks/apexRuntime.js` |
| `@salesforce/schema/<Object>.<Field>` | `{ objectApiName, fieldApiName }` |
| `lightning/empApi` | An in-page message bus for the Change Data Capture channels |
| `lightning/navigation` | Shows a toast saying which page Salesforce would open |
| `lightning/platformShowToastEvent` | Shows the toast with `lightning/toast` |
| `lightning/uiRecordApi`, `lightning/pageReferenceUtils` | Just what the components use |
| `lightning-record-picker` | A combobox of sample users |

The sample data in `src/mocks/denaliData.js` follows the org kit's seed scripts. Dates are relative to today, and formula fields (risk score, at-risk, backlog, margins) are computed the way the org computes them.

The showcase pages are `src/modules/page/overview` and `src/modules/page/showcase`. The tabs come from `src/showcase.config.js`.

## Adding or updating a component

1. Copy the component folder from the org kit's `force-app/main/default/lwc/` into `src/modules/c/`, without the `.js-meta.xml` and `__tests__`.
2. If it calls a new Apex method, add a handler for it to `src/mocks/apexHandlers.js`.
3. Add an entry to `src/showcase.config.js`, and import it in `COMPONENTS` in `src/modules/page/showcase/showcase.js`.

## Publish to GitHub Pages

```bash
npm run deploy
```

This builds with hash routing and pushes `dist/` to the `gh-pages` branch. In the repository's **Settings → Pages**, set **Source** to **Deploy from a branch**, then choose `gh-pages`.

## Built on

The [Salesforce Design System 2 Starter Kit](https://github.com/salesforce-ux/design-system-2-starter-kit): LWC, Vite, SLDS 2 and Lightning Base Components, with synthetic shadow DOM and client-side routing. The starter kit is licensed under Apache 2.0 (`LICENSE.txt`). This repository changes it: it adds the Denali app, its pages, the platform mocks and the Vite plugin, and makes Denali Components the default app. The starter kit's own Standard, Console and Builder apps are still available from the App Launcher.
