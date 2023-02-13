/// <reference types="node" />
export function getDashboardUrl(urlObject: any, tenant: any, projectId: any, runId: any, isLocalTesting: any): string;
import { URL } from "url";
import winston = require("winston");
export declare function loadAndCheckConfig(options: any, isLocalTesting: any, logger: any): Promise<{
    config: any;
    testOpts: any;
    lrcCfg: any;
    lrcUrl: any;
    lrcURLObject: URL;
    proxy: any;
}>;
export declare function loadAndCheckTestOpts(testOpts: any, logger: any): Promise<{
    projectId: any;
    testId: any;
    name: any;
    scripts: any;
    runTest: any;
    detach: any;
    downloadReport: any;
    settings: any;
    reportTypes: any;
    distributions: any;
    loadGenerators: any;
}>;
export declare function isOptionEnabled(option: any): boolean;
export declare function generateJUnitXmlReport(runData: any): Promise<void>;
export declare function validateReportType(reportTypes: any): any;
export declare function getFileExtensionByReportType(reportType: any): any;
export declare function createLogger(): winston.Logger;
//# sourceMappingURL=utils.d.ts.map