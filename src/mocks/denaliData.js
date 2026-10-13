/**
 * Sample Denali Defense records, the same story the org kit's seed scripts tell
 * (02_seed_demo_data.apex, 04_seed_revenue_history.apex), shaped the way the Apex
 * controllers return them. Dates are relative to today so the story never goes stale.
 *
 * Percent fields hold 18 for 18%, as Salesforce returns them. Formula fields
 * (Risk Score, Is At Risk, backlog, margins…) are computed here the way the org computes them.
 *
 * buildState() returns a fresh copy; the mock controllers in apexHandlers.js change it
 * (approvals, reviews) and Reset on each page puts it back.
 */

let seq = 0;
const ids = new Map();

/** A stable 18-character Salesforce-style Id per (prefix, key). */
export function sfId(prefix, key) {
    const k = `${prefix}:${key}`;
    if (!ids.has(k)) {
        seq += 1;
        ids.set(k, `${prefix}DD${String(seq).padStart(10, '0')}AAA`);
    }
    return ids.get(k);
}

export const ME = { Id: sfId('005', 'me'), Name: 'Jordan Ellis' };
export const USERS = [
    ME,
    { Id: sfId('005', 'gm'), Name: 'Alex Morgan' },
    { Id: sfId('005', 'pm2'), Name: 'Sam Patel' },
    { Id: sfId('005', 'cfo'), Name: 'Riley Chen' }
];

function day(offsetDays, from = new Date()) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays);
    return d;
}

function month(offsetMonths, extraDays = 0) {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + offsetMonths, t.getDate() + extraDays);
}

/** 'YYYY-MM-DD', as Date fields arrive from Apex. */
export function iso(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO datetime, as Datetime fields arrive from Apex. */
export function isoDateTime(offsetDays, hour = 10) {
    const d = day(offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
}

const D = (n) => iso(day(n));
const M = (n, extra = 0) => iso(month(n, extra));

function riskScore(likelihood, consequence) {
    if (!likelihood || !consequence) return null;
    return Number(likelihood[0]) * Number(consequence[0]);
}

function severity(score) {
    if (score === null) return null;
    if (score >= 15) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
}

const margin = (revenue, cost) => (revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null);

export function buildState() {
    const todayIso = D(0);

    // ------------------------------------------------------------ accounts
    const nda = {
        Id: sfId('001', 'nda'), Name: 'Northwind Defense Agency', Account_Role__c: 'Customer', Account_Status__c: 'Active',
        Customer_Tier__c: 'Strategic', Customer_Health__c: 'Yellow', Government_Account__c: true, Owner: { Name: ME.Name },
        Is_Customer__c: true, Is_Competitor__c: false
    };
    const flc = {
        Id: sfId('001', 'flc'), Name: 'Federal Logistics Command', Account_Role__c: 'Customer', Account_Status__c: 'Active',
        Customer_Tier__c: 'Key', Customer_Health__c: 'Green', Government_Account__c: true, Owner: { Name: ME.Name },
        Is_Customer__c: true, Is_Competitor__c: false
    };
    const aegis = {
        Id: sfId('001', 'aegis'), Name: 'Aegis Program Office', Account_Role__c: 'Customer', Account_Status__c: 'Prospect',
        Customer_Tier__c: 'Standard', Customer_Health__c: null, Government_Account__c: true, Owner: { Name: ME.Name },
        Is_Customer__c: true, Is_Competitor__c: false
    };
    const ironbridge = { Id: sfId('001', 'ironbridge'), Name: 'Ironbridge Systems', Account_Role__c: 'Supplier;Partner' };
    const halcyon = { Id: sfId('001', 'halcyon'), Name: 'Halcyon Engineering', Account_Role__c: 'Supplier' };
    const vantage = {
        Id: sfId('001', 'vantage'), Name: 'Vantage Federal', Account_Role__c: 'Competitor', Is_Competitor__c: true,
        Deals_Lost_To__c: 5, Bookings_Lost_To__c: 6500000
    };
    const accounts = [nda, flc, aegis, ironbridge, halcyon, vantage];

    const contacts = {
        cor: { Id: sfId('003', 'cor'), Name: 'Marcus Reyes' },
        logTech: { Id: sfId('003', 'logTech'), Name: 'Tom Becker' },
        ibPm: { Id: sfId('003', 'ibPm'), Name: 'Luis Ortega' },
        hcPm: { Id: sfId('003', 'hcPm'), Name: 'Grace Holloway' }
    };

    // ------------------------------------------------------------ projects
    const project = (key, f) => {
        const forecastMargin = margin(f.Revenue_Allocation__c, f.Forecast_Cost__c);
        return {
            Id: sfId('a02', key), Project_Manager__r: { Name: ME.Name }, ...f,
            Forecast_Margin__c: forecastMargin,
            Margin_Erosion__c: f.Bid_Margin__c === undefined ? null : Math.round((forecastMargin - f.Bid_Margin__c) * 10) / 10
        };
    };
    const ndaContractId = sfId('800', 'nda');
    const flcContractId = sfId('800', 'flc');
    const pSensor = project('sensor', {
        Name: 'Sensor Integration - Phase 1', Project_Number__c: 'PRJ-0001', Contract__c: ndaContractId, Account__c: nda.Id,
        Status__c: 'In Progress', Health__c: 'Yellow', Risk_Level__c: 'High', Percent_Complete__c: 55,
        Start_Date__c: M(-6), Target_End_Date__c: M(6), Budget__c: 2400000, Actual_Cost__c: 1450000, Forecast_Cost__c: 2620000,
        Revenue_Allocation__c: 3100000, Bid_Margin__c: 18
    });
    const pTraining = project('training', {
        Name: 'Operator Training & Documentation', Project_Number__c: 'PRJ-0002', Contract__c: ndaContractId, Account__c: nda.Id,
        Status__c: 'In Progress', Health__c: 'Green', Risk_Level__c: 'Low', Percent_Complete__c: 40,
        Start_Date__c: M(-3), Target_End_Date__c: M(4), Budget__c: 600000, Actual_Cost__c: 210000, Forecast_Cost__c: 580000,
        Revenue_Allocation__c: 820000, Bid_Margin__c: 28
    });
    const pNoc = project('noc', {
        Name: 'NOC Tooling Refresh', Project_Number__c: 'PRJ-0003', Contract__c: flcContractId, Account__c: flc.Id,
        Status__c: 'Complete', Health__c: 'Green', Risk_Level__c: 'Low', Percent_Complete__c: 100,
        Start_Date__c: M(-12), Target_End_Date__c: M(-4), Budget__c: 450000, Actual_Cost__c: 430000, Forecast_Cost__c: 430000,
        Revenue_Allocation__c: 540000, Bid_Margin__c: 22
    });
    const projects = [pSensor, pTraining, pNoc];

    // ------------------------------------------------------------ deliverables
    let delNo = 0;
    const deliverable = (key, f) => {
        delNo += 1;
        const d = {
            Id: sfId('a03', key), Deliverable_Number__c: `DEL-${String(delNo).padStart(4, '0')}`,
            Contract__c: projects.find((p) => p.Id === f.Project__c).Contract__c, ...f
        };
        d.Project__r = { Name: projects.find((p) => p.Id === d.Project__c).Name };
        return withDeliverableFormulas(d, todayIso);
    };
    const dDesign = deliverable('design', {
        Name: 'CDRL A001 - System Design Document', Project__c: pSensor.Id, Deliverable_Type__c: 'Documentation',
        Status__c: 'Complete', Health__c: 'Green', Priority__c: 'High', Percent_Complete__c: 100, Planned_Start_Date__c: M(-6),
        Due_Date__c: M(-4), Forecast_Completion_Date__c: M(-4), Actual_Completion_Date__c: M(-4, -3),
        Acceptance_Status__c: 'Accepted', Revenue_Milestone__c: 450000, Supplier__r: { Name: ironbridge.Name }, Risk_Level__c: 'Low'
    });
    const dSoftware = deliverable('software', {
        Name: 'Sensor Fusion Software Build 2.0', Project__c: pSensor.Id, Deliverable_Type__c: 'Software',
        Status__c: 'Blocked', Health__c: 'Red', Priority__c: 'Critical', Percent_Complete__c: 60, Planned_Start_Date__c: M(-3),
        Due_Date__c: D(20), Forecast_Completion_Date__c: D(55), Acceptance_Status__c: 'Not Submitted',
        Revenue_Milestone__c: 900000, Supplier__r: { Name: ironbridge.Name }, Risk_Level__c: 'Critical',
        Requires_Customer_Action__c: true, Latest_Update_Date__c: D(-2)
    });
    const dHardware = deliverable('hardware', {
        Name: 'Ground Station Hardware Kit (x12)', Project__c: pSensor.Id, Deliverable_Type__c: 'Hardware',
        Status__c: 'In Progress', Health__c: 'Yellow', Priority__c: 'High', Percent_Complete__c: 45, Planned_Start_Date__c: M(-2),
        Due_Date__c: M(2), Forecast_Completion_Date__c: M(2, 10), Acceptance_Status__c: 'Not Submitted',
        Revenue_Milestone__c: 1200000, Supplier__r: { Name: halcyon.Name }, Risk_Level__c: 'Medium', Latest_Update_Date__c: D(-3)
    });
    const dTest = deliverable('test', {
        Name: 'Integration Test Report', Project__c: pSensor.Id, Deliverable_Type__c: 'Testing', Status__c: 'Not Started',
        Health__c: 'Green', Priority__c: 'Medium', Percent_Complete__c: 0, Planned_Start_Date__c: M(3), Due_Date__c: M(5),
        Forecast_Completion_Date__c: M(5), Acceptance_Status__c: 'Not Submitted', Revenue_Milestone__c: 300000, Risk_Level__c: 'Low'
    });
    const dCurriculum = deliverable('curriculum', {
        Name: 'Operator Training Curriculum', Project__c: pTraining.Id, Deliverable_Type__c: 'Training', Status__c: 'Submitted',
        Health__c: 'Green', Priority__c: 'Medium', Percent_Complete__c: 90, Planned_Start_Date__c: M(-3), Due_Date__c: D(10),
        Forecast_Completion_Date__c: D(7), Acceptance_Status__c: 'Pending Review', Revenue_Milestone__c: 250000, Risk_Level__c: 'Low'
    });
    const dManual = deliverable('manual', {
        Name: 'Technical Manual Set', Project__c: pTraining.Id, Deliverable_Type__c: 'Documentation', Status__c: 'In Progress',
        Health__c: 'Yellow', Priority__c: 'Medium', Percent_Complete__c: 35, Planned_Start_Date__c: M(-2), Due_Date__c: D(-5),
        Forecast_Completion_Date__c: D(25), Acceptance_Status__c: 'Not Submitted', Revenue_Milestone__c: 180000,
        Supplier__r: { Name: ironbridge.Name }, Risk_Level__c: 'Medium', Latest_Update_Date__c: D(-1)
    });
    const dCutover = deliverable('cutover', {
        Name: 'Monitoring Platform Cutover', Project__c: pNoc.Id, Deliverable_Type__c: 'Integration', Status__c: 'Complete',
        Health__c: 'Green', Priority__c: 'High', Percent_Complete__c: 100, Planned_Start_Date__c: M(-9), Due_Date__c: M(-5),
        Forecast_Completion_Date__c: M(-5), Actual_Completion_Date__c: M(-5), Acceptance_Status__c: 'Accepted',
        Revenue_Milestone__c: 540000, Supplier__r: { Name: halcyon.Name }, Risk_Level__c: 'Low'
    });
    const deliverables = [dDesign, dSoftware, dHardware, dTest, dCurriculum, dManual, dCutover];

    // ------------------------------------------------------------ contracts
    const contract = (f) => {
        const k = { ...f };
        const ps = projects.filter((p) => p.Contract__c === k.Id);
        const ds = deliverables.filter((d) => d.Contract__c === k.Id);
        k.Revenue_Recognized__c = ds.filter((d) => d.Acceptance_Status__c === 'Accepted').reduce((s, d) => s + d.Revenue_Milestone__c, 0);
        k.Revenue_Allocation__c = ps.reduce((s, p) => s + p.Revenue_Allocation__c, 0);
        k.Forecast_Cost__c = ps.reduce((s, p) => s + p.Forecast_Cost__c, 0);
        k.Actual_Cost__c = ps.reduce((s, p) => s + p.Actual_Cost__c, 0);
        return withContractFormulas(k);
    };
    const kNda = contract({
        Id: ndaContractId, ContractNumber: '00000101', Award_Number__c: 'NDA-2026-001', Status: 'Activated', AccountId: nda.Id,
        StartDate: M(-7), EndDate: M(29), Contract_Type__c: 'Fixed Price', Contract_Value__c: 12600000, Funded_Value__c: 5200000,
        Original_Margin__c: 18, Contract_Health__c: 'Yellow', Current_Period__c: 'Base', Next_Option_Date__c: M(5),
        Program_Manager__r: { Name: ME.Name }
    });
    const kFlc = contract({
        Id: flcContractId, ContractNumber: '00000102', Award_Number__c: 'FLC-2025-014', Status: 'Activated', AccountId: flc.Id,
        StartDate: M(-13), EndDate: M(23), Contract_Type__c: 'Time & Materials', Contract_Value__c: 5400000, Funded_Value__c: 3600000,
        Original_Margin__c: 22, Contract_Health__c: 'Green', Current_Period__c: 'Option Year 1', Next_Option_Date__c: M(2),
        Program_Manager__r: { Name: ME.Name }
    });
    const contracts = [kNda, kFlc];

    // ------------------------------------------------------------ supplier updates
    const update = (key, f) => {
        const del = deliverables.find((d) => d.Id === f.Deliverable__c);
        return {
            Id: sfId('a04', key),
            Deliverable__r: { Name: del.Name, Project__c: del.Project__c },
            ...f
        };
    };
    let updNo = 0;
    const nextUpdName = () => `DU-${String(++updNo).padStart(5, '0')}`;
    const deliverableUpdates = [
        update('sw1', {
            Name: nextUpdName(), Deliverable__c: dSoftware.Id, Supplier__r: { Name: ironbridge.Name }, Submitted_By__r: { Name: contacts.ibPm.Name },
            Submitted_Date__c: isoDateTime(-14), Reported_Status__c: 'In Progress', Percent_Complete__c: 60, Forecast_Completion_Date__c: D(30),
            Supplier_Health__c: 'Yellow', Progress_Summary__c: 'Core fusion algorithms complete; UI integration underway.',
            Next_Steps__c: 'Begin system integration once GFI test data arrives.', Internal_Review_Status__c: 'Accepted',
            Reviewed_By__r: { Name: ME.Name }, Review_Date__c: D(-12)
        }),
        update('sw2', {
            Name: nextUpdName(), Deliverable__c: dSoftware.Id, Supplier__r: { Name: ironbridge.Name }, Submitted_By__r: { Name: contacts.ibPm.Name },
            Submitted_Date__c: isoDateTime(-2), Reported_Status__c: 'Blocked', Percent_Complete__c: 60, Forecast_Completion_Date__c: D(55),
            Supplier_Health__c: 'Red', Progress_Summary__c: 'No progress on integration this week.',
            Blockers__c: 'Government-furnished test data still not received.', Requires_Customer_Action__c: true,
            Customer_Action__c: 'Deliver GFI test data package.', Internal_Review_Status__c: 'Pending'
        }),
        update('hw1', {
            Name: nextUpdName(), Deliverable__c: dHardware.Id, Supplier__r: { Name: halcyon.Name }, Submitted_By__r: { Name: contacts.hcPm.Name },
            Submitted_Date__c: isoDateTime(-3), Reported_Status__c: 'In Progress', Percent_Complete__c: 45, Forecast_Completion_Date__c: M(2, 10),
            Supplier_Health__c: 'Yellow', Progress_Summary__c: '5 of 12 kits assembled; connector lead times slipping.',
            Internal_Review_Status__c: 'Needs Clarification', Reviewed_By__r: { Name: ME.Name }, Review_Date__c: D(-1),
            Reviewer_Comments__c: 'Please confirm whether the connector delay affects the kit ship date.'
        }),
        update('man1', {
            Name: nextUpdName(), Deliverable__c: dManual.Id, Supplier__r: { Name: ironbridge.Name }, Submitted_By__r: { Name: contacts.ibPm.Name },
            Submitted_Date__c: isoDateTime(-1), Reported_Status__c: 'In Progress', Percent_Complete__c: 35, Forecast_Completion_Date__c: D(25),
            Supplier_Health__c: 'Yellow', Progress_Summary__c: 'Volumes 1-2 drafted; volume 3 waiting on final hardware photos.',
            Internal_Review_Status__c: 'Pending'
        })
    ];

    // ------------------------------------------------------------ suppliers and team
    const supplierAssignments = [
        { Id: sfId('a05', 'sa1'), Supplier__c: ironbridge.Id, Supplier__r: { Name: ironbridge.Name }, Project__r: { Name: pSensor.Name }, Account__c: nda.Id, Role__c: 'Subcontractor', Status__c: 'Active', Performance_Rating__c: 'Satisfactory', Contract_Value__c: 780000, Primary_Supplier__c: true },
        { Id: sfId('a05', 'sa2'), Supplier__c: halcyon.Id, Supplier__r: { Name: halcyon.Name }, Project__r: { Name: pSensor.Name }, Account__c: nda.Id, Role__c: 'Hardware Supplier', Status__c: 'Active', Performance_Rating__c: 'Very Good', Contract_Value__c: 640000, Primary_Supplier__c: false },
        { Id: sfId('a05', 'sa3'), Supplier__c: ironbridge.Id, Supplier__r: { Name: ironbridge.Name }, Project__r: { Name: pTraining.Name }, Account__c: nda.Id, Role__c: 'Professional Services', Status__c: 'Active', Performance_Rating__c: null, Contract_Value__c: 150000, Primary_Supplier__c: false },
        { Id: sfId('a05', 'sa4'), Supplier__c: halcyon.Id, Supplier__r: { Name: halcyon.Name }, Project__r: { Name: pNoc.Name }, Account__c: flc.Id, Role__c: 'Engineering Partner', Status__c: 'Completed', Performance_Rating__c: 'Exceptional', Contract_Value__c: 120000, Primary_Supplier__c: false }
    ];
    const projectResources = [
        { Id: sfId('a06', 'r1'), Employee__r: { Name: ME.Name }, Project__r: { Name: pSensor.Name }, Account__c: nda.Id, Role__c: 'Project Manager', Allocation__c: 40, Resource_Status__c: 'Active', Start_Date__c: pSensor.Start_Date__c, End_Date__c: pSensor.Target_End_Date__c },
        { Id: sfId('a06', 'r2'), Employee__r: { Name: 'Sam Patel' }, Project__r: { Name: pSensor.Name }, Account__c: nda.Id, Role__c: 'Systems Engineer', Allocation__c: 80, Resource_Status__c: 'Active', Start_Date__c: pSensor.Start_Date__c, End_Date__c: pSensor.Target_End_Date__c },
        { Id: sfId('a06', 'r3'), Employee__r: { Name: ME.Name }, Project__r: { Name: pTraining.Name }, Account__c: nda.Id, Role__c: 'Project Manager', Allocation__c: 40, Resource_Status__c: 'Active', Start_Date__c: pTraining.Start_Date__c, End_Date__c: pTraining.Target_End_Date__c },
        { Id: sfId('a06', 'r4'), Employee__r: { Name: 'Casey Nguyen' }, Project__r: { Name: pTraining.Name }, Account__c: nda.Id, Role__c: 'Technical Writer', Allocation__c: 50, Resource_Status__c: 'Active', Start_Date__c: pTraining.Start_Date__c, End_Date__c: pTraining.Target_End_Date__c },
        { Id: sfId('a06', 'r5'), Employee__r: { Name: 'Morgan Diaz' }, Project__r: { Name: pNoc.Name }, Account__c: flc.Id, Role__c: 'Network Engineer', Allocation__c: 20, Resource_Status__c: 'Active', Start_Date__c: M(-1), End_Date__c: M(11) }
    ];

    // ------------------------------------------------------------ service
    const seNoc = {
        Id: sfId('a07', 'noc'), Name: 'FLC Network Operations Support', Account__c: flc.Id, Contract__c: flcContractId,
        Service_Type__c: 'Managed Services', Status__c: 'Active', Health__c: 'Green', Service_Level__c: 'Gold', Cases_Open__c: 2,
        SLA_Breaches__c: 0, Next_Milestone_Date__c: D(30), Annual_Contract_Value__c: 1800000, Service_Owner__r: { Name: ME.Name }
    };
    const seSustain = {
        Id: sfId('a07', 'sustain'), Name: 'NDA Sensor Sustainment', Account__c: nda.Id, Contract__c: ndaContractId,
        Service_Type__c: 'Sustainment', Status__c: 'Active', Health__c: 'Yellow', Service_Level__c: 'Platinum', Cases_Open__c: 1,
        SLA_Breaches__c: 1, Next_Milestone_Date__c: D(-3), Annual_Contract_Value__c: 720000, Service_Owner__r: { Name: ME.Name }
    };
    const serviceEngagements = [seNoc, seSustain];

    const cases = [
        {
            Id: sfId('500', 'router'), CaseNumber: '00001001', Subject: 'Core router outage at Denver depot', AccountId: flc.Id,
            Account: { Name: flc.Name }, Status: 'Working', Priority: 'Critical', Severity__c: 'Sev 1 - Critical Outage',
            Customer_Impact__c: 'Site / Program', IsEscalated: true, IsClosed: false, CreatedDate: isoDateTime(0, 6),
            Service_Engagement__c: seNoc.Id, Service_Engagement__r: { Name: seNoc.Name }, Deliverable__c: null, Project__c: null
        },
        {
            Id: sfId('500', 'vpn'), CaseNumber: '00001002', Subject: 'VPN access for new logistics analysts', AccountId: flc.Id,
            Account: { Name: flc.Name }, Status: 'Waiting on Customer', Priority: 'Low', Severity__c: 'Sev 4 - Informational / Request',
            Customer_Impact__c: 'Multiple Users', IsEscalated: false, IsClosed: false, CreatedDate: isoDateTime(-4),
            Service_Engagement__c: seNoc.Id, Service_Engagement__r: { Name: seNoc.Name }, Deliverable__c: null, Project__c: null
        },
        {
            Id: sfId('500', 'fusion'), CaseNumber: '00001004', Subject: 'Fusion build crashes on legacy sensor feed', AccountId: nda.Id,
            Account: { Name: nda.Name }, Status: 'New', Priority: 'High', Severity__c: 'Sev 2 - Major Degradation',
            Customer_Impact__c: 'Site / Program', IsEscalated: false, IsClosed: false, CreatedDate: isoDateTime(0, 4),
            Service_Engagement__c: seSustain.Id, Service_Engagement__r: { Name: seSustain.Name },
            Deliverable__c: dSoftware.Id, Deliverable__r: { Name: dSoftware.Name }, Project__c: pSensor.Id
        }
    ];

    // ------------------------------------------------------------ risks
    const risk = (key, f) => {
        const score = riskScore(f.Likelihood__c, f.Consequence__c);
        return {
            Id: sfId('a08', key), Risk_Owner__r: { Name: ME.Name }, Risk_Score__c: score, Severity__c: severity(score),
            CreatedDate: isoDateTime(-(f.age || 7)), ...f
        };
    };
    let riskNo = 0;
    const rn = () => `RSK-${String(++riskNo).padStart(4, '0')}`;
    const risks = [
        risk('gfi', {
            Name: 'GFI test data late', Risk_Number__c: rn(), Account__c: nda.Id, Contract__c: ndaContractId, Project__c: pSensor.Id,
            Project__r: { Name: pSensor.Name }, Deliverable__c: dSoftware.Id, Deliverable__r: { Name: dSoftware.Name },
            Risk_Category__c: 'Customer', Likelihood__c: '5 - Near Certainty', Consequence__c: '4 - Significant', Status__c: 'Mitigating',
            Target_Resolution_Date__c: D(14), Revenue_at_Risk__c: 900000, age: 21
        }),
        risk('crash', {
            Name: 'Case 00001004: Fusion build crashes on legacy sensor feed', Risk_Number__c: rn(), Account__c: nda.Id,
            Contract__c: ndaContractId, Project__c: pSensor.Id, Project__r: { Name: pSensor.Name }, Deliverable__c: dSoftware.Id,
            Deliverable__r: { Name: dSoftware.Name }, Risk_Category__c: 'Technical', Likelihood__c: '4 - Highly Likely',
            Consequence__c: '3 - Moderate', Status__c: 'Identified', Target_Resolution_Date__c: D(10), age: 0
        }),
        risk('connector', {
            Name: 'Connector supply chain delay', Risk_Number__c: rn(), Account__c: nda.Id, Contract__c: ndaContractId, Project__c: pSensor.Id,
            Project__r: { Name: pSensor.Name }, Deliverable__c: dHardware.Id, Deliverable__r: { Name: dHardware.Name },
            Risk_Category__c: 'Supplier', Likelihood__c: '3 - Likely', Consequence__c: '3 - Moderate', Status__c: 'Monitoring',
            Target_Resolution_Date__c: D(30), age: 10
        }),
        risk('attrition', {
            Name: 'Key engineer attrition', Risk_Number__c: rn(), Account__c: nda.Id, Contract__c: ndaContractId, Project__c: pTraining.Id,
            Project__r: { Name: pTraining.Name }, Risk_Category__c: 'Staffing', Likelihood__c: '2 - Low Likelihood',
            Consequence__c: '3 - Moderate', Status__c: 'Identified', age: 30
        }),
        risk('funding', {
            Name: 'Option Year 2 funding uncertainty', Risk_Number__c: rn(), Account__c: flc.Id, Contract__c: flcContractId,
            Risk_Category__c: 'Cost', Likelihood__c: '3 - Likely', Consequence__c: '5 - Severe', Status__c: 'Analyzing',
            Revenue_at_Risk__c: 1850000, age: 14
        })
    ];

    // ------------------------------------------------------------ opportunities
    const opp = (key, f) => {
        const o = { Id: sfId('006', key), IsClosed: false, ...f };
        const floor = f.Contract_Type__c === 'Cost Plus' ? 7 : f.Contract_Type__c === 'Time & Materials' ? 10 : 12;
        o.Margin_Floor__c = floor;
        o.Below_Margin_Floor__c = o.Estimated_Margin__c !== undefined && o.Estimated_Margin__c < floor;
        o.Margin_Shortfall__c = o.Below_Margin_Floor__c ? Math.round((o.Amount * (floor - o.Estimated_Margin__c)) / 100) : null;
        return o;
    };
    const incumbent = { Name: vantage.Name, Deals_Lost_To__c: vantage.Deals_Lost_To__c, Bookings_Lost_To__c: vantage.Bookings_Lost_To__c };
    const zeroTrust = opp('zt', {
        Name: 'Aegis - Zero Trust Production (FFP)', AccountId: aegis.Id, Account: { Name: aegis.Name }, Amount: 2400000,
        StageName: 'Capture / Shaping', CloseDate: M(4), Contract_Type__c: 'Fixed Price', Acquisition_Type__c: 'Competitive',
        Estimated_Margin__c: 9, Estimated_Contract_Value__c: 7200000, Margin_Approval_Status__c: null,
        Incumbent__c: vantage.Id, Incumbent__r: incumbent,
        Pricing_Rationale__c:
            'Summary: We are pricing Zero Trust Production at 9%, three points under the 12% fixed-price floor, to unseat Vantage Federal.\n' +
            'Why: Vantage has won five of our last head-to-head bids on price. Our wins against them averaged 13.5% margin; our losses averaged 18%.\n' +
            'Mitigation: Reuse the prototype architecture from the OTA to cut integration labor, and price option years at 14%.'
    });
    const ota = opp('ota', {
        Name: 'Aegis - Zero Trust Prototype (OTA)', AccountId: aegis.Id, Account: { Name: aegis.Name }, Amount: 950000,
        StageName: 'Capture / Shaping', CloseDate: M(6), Contract_Type__c: 'Cost Plus', Acquisition_Type__c: 'OTA',
        Estimated_Margin__c: 15, Estimated_Contract_Value__c: 3100000, Incumbent__c: vantage.Id, Incumbent__r: incumbent,
        Pricing_Rationale__c: null
    });
    const flcOption = opp('flcopt', {
        Name: 'FLC - Network Ops Option Year 2', AccountId: flc.Id, Account: { Name: flc.Name }, Amount: 1850000,
        StageName: 'Proposal Submitted', CloseDate: M(2, -14), Contract_Type__c: 'Time & Materials', Acquisition_Type__c: 'Sole Source',
        Estimated_Margin__c: 21, Estimated_Contract_Value__c: 1850000, Pricing_Rationale__c: null
    });
    const opportunities = [zeroTrust, ota, flcOption];

    // Closed deals against Vantage Federal (04_seed_revenue_history.apex), for Competitor Intel.
    const h2h = (key, name, account, closeOffset, won, amount, marginPct, lossReason) => ({
        id: sfId('006', key), name, accountName: account.Name, closeDate: D(closeOffset), won, amount, margin: marginPct, lossReason
    });
    const headToHead = [
        h2h('h1', 'NDA - Operator Training Task Order', nda, -40, true, 1200000, 12, null),
        h2h('h2', 'Aegis - Cyber Range Pilot', aegis, -77, false, 2200000, 17, 'Price'),
        h2h('h3', 'FLC - Depot Automation Study', flc, -49, false, 1100000, 20, 'Incumbent Advantage'),
        h2h('h4', 'NDA - Cyber Assessment Task Order', nda, -135, true, 1900000, 13, null),
        h2h('h5', 'Aegis - Cloud Migration Assessment', aegis, -150, false, 800000, 18, 'Price'),
        h2h('h6', 'NDA - Logistics Analytics Task Order', nda, -195, true, 1600000, 11, null),
        h2h('h7', 'Aegis - Identity Modernization', aegis, -240, false, 1500000, 16, 'Price'),
        h2h('h8', 'FLC - Warehouse RFID Pilot', flc, -210, false, 900000, 19, 'Technical'),
        h2h('h9', 'NDA - Integrated Sensor Modernization', nda, -240, true, 4200000, 18, null)
    ].sort((a, b) => b.closeDate.localeCompare(a.closeDate));

    // Margin Exception approvals: one waiting on the viewer when the showcase opens.
    const approvals = [
        {
            workitemId: sfId('04i', 'ota'), recordId: ota.Id, recordName: ota.Name, objectType: 'Opportunity',
            submittedBy: 'Alex Morgan', submittedDate: isoDateTime(-1, 15), opportunity: null, opportunityId: ota.Id,
            approverId: ME.Id
        }
    ];
    // The OTA sits under its Cost Plus floor in the approvals list so there's something to decide.
    ota.Estimated_Margin__c = 6;
    Object.assign(ota, opp('ota', ota));
    ota.Margin_Approval_Status__c = 'Pending';
    ota.Pricing_Rationale__c =
        'Summary: Prototype priced at 6% to win the OTA and position for the Zero Trust production award.\n' +
        'Why: The production follow-on is worth $7.2M; Vantage Federal is the incumbent.';

    return {
        accounts, contracts, projects, deliverables, deliverableUpdates, supplierAssignments, projectResources,
        serviceEngagements, cases, risks, opportunities, headToHead, approvals,
        competitorId: vantage.Id,
        updateSeq: updNo
    };
}

export function withDeliverableFormulas(d, todayIso = D(0)) {
    const done = d.Status__c === 'Complete' || d.Status__c === 'Cancelled';
    d.Is_At_Risk__c = d.Health__c === 'Red' || d.Status__c === 'Blocked' || d.Risk_Level__c === 'Critical';
    d.Is_Overdue__c = !!d.Due_Date__c && d.Due_Date__c < todayIso && !done;
    d.Schedule_Variance_Days__c =
        d.Forecast_Completion_Date__c && d.Due_Date__c
            ? Math.round((new Date(d.Forecast_Completion_Date__c) - new Date(d.Due_Date__c)) / 86400000)
            : null;
    return d;
}

function withContractFormulas(k) {
    k.Total_Backlog__c = k.Contract_Value__c - k.Revenue_Recognized__c;
    k.Funded_Backlog__c = k.Funded_Value__c - k.Revenue_Recognized__c;
    k.Percent_Funded__c = k.Contract_Value__c > 0 ? Math.round((k.Funded_Value__c / k.Contract_Value__c) * 1000) / 10 : 0;
    k.Current_Margin__c = margin(k.Revenue_Allocation__c, k.Forecast_Cost__c);
    k.Margin_Variance__c = k.Current_Margin__c === null ? null : Math.round((k.Current_Margin__c - k.Original_Margin__c) * 10) / 10;
    return k;
}
