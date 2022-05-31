/*
 * © Copyright 2022 Micro Focus or one of its affiliates.
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with the License.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { URL } from "url";
import winston = require("winston");
export function loadAndCheckConfig(options: any, isLocalTesting: any, logger: any): Promise<{
    config: any;
    testOpts: any;
    lrcCfg: any;
    lrcUrl: any;
    lrcURLObject: URL;
    proxy: any;
}>;
export function loadAndCheckTestOpts(testOpts: any, logger: any): Promise<{
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
export function isOptionEnabled(option: any): boolean;
export function getDashboardUrl(urlObject: any, tenant: any, projectId: any, runId: any, isLocalTesting: any): string;
export function getReportUrl(urlObject: any, tenant: any, projectId: any, runId: any, isLocalTesting: any): string;
export function validateReportType(reportTypes: any): any;
export function createLogger(): winston.Logger;
export function generateJUnitXmlReport(any): Promise<any>;
export function getFileExtensionByReportType(reportType: string): string;
//# sourceMappingURL=utils.d.ts.map
