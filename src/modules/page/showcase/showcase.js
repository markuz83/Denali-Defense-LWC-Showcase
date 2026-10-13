import { LightningElement } from 'lwc';
import Toast from 'lightning/toast';
import { subscribe as subscribeToRoute } from '../../../router';
import { showcase } from '../../../showcase.config';
import { resetState, simulateSupplierUpdate } from '../../../mocks/apexHandlers.js';
import { publishChange } from '../../../mocks/lightning/empApi';
import { describeRecord } from '../../../mocks/recordNames.js';

import AccountCommandCenter from 'c/accountCommandCenter';
import AccountCommandCenterMobile from 'c/accountCommandCenterMobile';
import AccountSupplierUpdates from 'c/accountSupplierUpdates';
import AccountSuppliers from 'c/accountSuppliers';
import AccountTeam from 'c/accountTeam';
import CommandCenterRiskHeatmap from 'c/commandCenterRiskHeatmap';
import CommandCenterTimeline from 'c/commandCenterTimeline';
import CompetitorIntel from 'c/competitorIntel';
import ContractHealth from 'c/contractHealth';
import HealthDatatable from 'c/healthDatatable';
import HealthDot from 'c/healthDot';
import ImpactChain from 'c/impactChain';
import MarginGuardrail from 'c/marginGuardrail';
import MyProjects from 'c/myProjects';
import PricingApprovals from 'c/pricingApprovals';
import ProjectTimeline from 'c/projectTimeline';
import SupplierUpdateReview from 'c/supplierUpdateReview';

const COMPONENTS = {
    accountCommandCenter: AccountCommandCenter,
    accountCommandCenterMobile: AccountCommandCenterMobile,
    accountSupplierUpdates: AccountSupplierUpdates,
    accountSuppliers: AccountSuppliers,
    accountTeam: AccountTeam,
    commandCenterRiskHeatmap: CommandCenterRiskHeatmap,
    commandCenterTimeline: CommandCenterTimeline,
    competitorIntel: CompetitorIntel,
    contractHealth: ContractHealth,
    healthDatatable: HealthDatatable,
    healthDot: HealthDot,
    impactChain: ImpactChain,
    marginGuardrail: MarginGuardrail,
    myProjects: MyProjects,
    pricingApprovals: PricingApprovals,
    projectTimeline: ProjectTimeline,
    supplierUpdateReview: SupplierUpdateReview
};

const STAGE_CLASS = {
    full: 'stage',
    main: 'stage stage_main',
    sidebar: 'stage stage_sidebar',
    phone: 'stage stage_phone'
};

// Record links inside the components point at "/<recordId>", as they do in Lightning Experience.
const RECORD_HREF = /\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/;

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * One tab per Denali component: a header saying where it lives in Salesforce, things to try,
 * a choice of sample records, and the component itself, unchanged from the org kit and
 * running against the mock Apex in src/mocks.
 */
export default class Showcase extends LightningElement {
    entry;
    exampleIndex = 0;
    // Bumped to re-create the component (new example, reset), so it starts clean.
    generation = 0;

    connectedCallback() {
        this.unsubscribe = subscribeToRoute((route) => {
            const entry = showcase.find((e) => e.id === route?.navPage);
            if (entry && entry !== this.entry) {
                this.entry = entry;
                this.exampleIndex = 0;
                this.generation += 1;
            }
        });
        window.addEventListener('click', this.handleRecordLinkClick, true);
    }

    disconnectedCallback() {
        this.unsubscribe?.();
        window.removeEventListener('click', this.handleRecordLinkClick, true);
    }

    // ---------------------------------------------------------------- header

    get title() {
        return this.entry?.label;
    }

    get tagName() {
        return this.entry ? `c-${kebab(this.entry.component)}` : '';
    }

    get sourcePath() {
        return this.entry ? `src/modules/c/${this.entry.component}` : '';
    }

    get placement() {
        return this.entry?.placement;
    }

    get summary() {
        return this.entry?.summary;
    }

    get tryIt() {
        return (this.entry?.tryIt || []).map((text, i) => ({ key: `try-${i}`, text }));
    }

    get hasTryIt() {
        return this.tryIt.length > 0;
    }

    get isLive() {
        return !!this.entry?.live;
    }

    // ---------------------------------------------------------------- examples

    get hasExampleChoice() {
        return (this.entry?.examples || []).length > 1;
    }

    get exampleOptions() {
        return this.entry.examples.map((ex, i) => ({ label: ex.label, value: String(i) }));
    }

    get exampleValue() {
        return String(this.exampleIndex);
    }

    handleExampleChange(event) {
        this.exampleIndex = Number(event.detail.value);
        this.generation += 1;
    }

    // ---------------------------------------------------------------- stage

    get stageClass() {
        return STAGE_CLASS[this.entry?.width] || STAGE_CLASS.full;
    }

    // A one-item list keyed by generation: a new key makes LWC build a fresh component.
    get instances() {
        if (!this.entry) return [];
        const example = this.entry.examples[this.exampleIndex] || { props: {} };
        const props = typeof example.props === 'function' ? example.props() : example.props;
        return [{ key: `${this.entry.id}-${this.exampleIndex}-${this.generation}`, ctor: COMPONENTS[this.entry.component], props }];
    }

    // ---------------------------------------------------------------- actions

    handleSimulate() {
        publishChange(simulateSupplierUpdate());
        Toast.show({
            label: 'Supplier update submitted',
            message: 'Ironbridge Systems posted an update on Sensor Fusion Software Build 2.0. Live components refresh on their own.',
            variant: 'info',
            mode: 'dismissible'
        });
    }

    handleReset() {
        resetState();
        this.generation += 1;
        Toast.show({ label: 'Sample data reset', variant: 'success', mode: 'dismissible' });
    }

    handleRecordLinkClick = (event) => {
        const anchor = event.composedPath().find((el) => el.tagName === 'A');
        const href = anchor?.getAttribute('href');
        const match = href && href.match(RECORD_HREF);
        if (!match) return;
        event.preventDefault();
        Toast.show({
            label: 'Navigation',
            message: `In Salesforce, this opens the ${describeRecord(match[1])} record page.`,
            variant: 'info',
            mode: 'dismissible'
        });
    };
}
