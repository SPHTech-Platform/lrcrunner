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

const winston = require('winston');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const _ = require('lodash');
const { URL } = require('url');
const path = require('path');
const xmlbuilder = require('xmlbuilder');

const getRunResultUrl = (urlObject, tenant, projectId, runId, isLocalTesting, type) => {
  const dashboardUrl = new URL(urlObject.href);

  if (isLocalTesting) {
    if (dashboardUrl.port === '3032') {
      dashboardUrl.port = '3030';
    }
  }

  dashboardUrl.searchParams.append('TENANTID', tenant);
  dashboardUrl.searchParams.append('projectId', projectId);
  dashboardUrl.pathname = `/run-overview/${runId}/${type}/`;

  return dashboardUrl.toString();
};

const getDashboardUrl = (urlObject, tenant, projectId, runId, isLocalTesting) => getRunResultUrl(urlObject, tenant, projectId, runId, isLocalTesting, 'dashboard');
const getReportUrl = (urlObject, tenant, projectId, runId, isLocalTesting) => getRunResultUrl(urlObject, tenant, projectId, runId, isLocalTesting, 'report');

const utils = {
  getDashboardUrl,
  loadAndCheckConfig: async (options, isLocalTesting, logger) => {
    const configFile = options.run;
    if (_.isEmpty(configFile)) {
      throw new Error('configuration file is missing');
    }
    logger.info(`config file: ${configFile}`);

    const configFileData = await fs.promises.readFile(configFile, 'utf8');
    const config = yaml.load(configFileData);
    const { scenarios } = config;
    if (_.isEmpty(scenarios)) {
      throw new Error('invalid configuration file: scenarios is missing');
    }

    const scenarioName = _.first(_.keys(scenarios));
    if (_.isEmpty(scenarioName)) {
      throw new Error('invalid configuration file: scenario name is missing');
    }

    logger.info(`scenario name: ${scenarioName}`);
    const testOpts = _.get(scenarios, scenarioName);
    if (!_.isObject(testOpts)) {
      throw new Error(`no information for scenario: ${scenarioName}`);
    }

    const lrcCfg = (config.modules || {}).lrc || {};

    let lrcUrl = options.url || lrcCfg.url;
    if (_.isEmpty(lrcUrl)) {
      if (isLocalTesting) {
        lrcUrl = 'http://127.0.0.1:3030';
      } else {
        lrcUrl = 'https://loadrunner-cloud.saas.microfocus.com';
      }
    }

    let lrcURLObject;
    try {
      lrcURLObject = new URL(lrcUrl);

      if (isLocalTesting) {
        if (lrcURLObject.port === '3030') {
          lrcURLObject.port = '3032';
        }
      }
    } catch (ex) {
      throw new Error('invalid LRC url');
    }

    let proxy;
    if (config.settings && config.settings.proxy && _.isString(config.settings.proxy.address)) {
      proxy = config.settings.proxy.address;
      logger.info(`proxy: ${proxy}`);
    }

    return {
      config, testOpts, lrcCfg, lrcUrl, lrcURLObject, proxy,
    };
  },

  loadAndCheckTestOpts: async (testOpts, logger) => {
    let { projectId, scripts } = testOpts;
    if (!projectId) {
      logger.info('project id is not specified, use default project 1');
      projectId = 1;
    }
    if (!_.isInteger(projectId) || projectId < 1) {
      throw new Error('invalid projectId');
    }

    logger.info(`project id: ${projectId}`);

    const {
      testId, name, runTest = true, detach = false, downloadReport = true,
      settings = {}, distributions = [], loadGenerators = [],
    } = testOpts;

    if (!testId && _.isEmpty(name)) {
      throw new Error('test name is missing');
    }

    if (testId) {
      if (!_.isInteger(testId) || testId < 1) {
        throw new Error('invalid testId');
      }
    }

    let { reportType } = testOpts;
    if (_.isEmpty(reportType)) {
      reportType = 'pdf';
    }

    let reportTypes;
    if (_.isArray(reportType)) {
      reportTypes = _.uniq(reportType);
    } else {
      reportTypes = [reportType];
    }

    if (!utils.validateReportType(reportTypes)) {
      throw new Error('invalid reportType');
    }

    if (!testId) {
      if (_.isEmpty(scripts)) {
        scripts = testOpts.script;
      }
      if (!_.isArray(scripts) || scripts.length <= 0) {
        throw new Error('scripts is required');
      }
    }

    return {
      projectId,
      testId,
      name,
      scripts,
      runTest,
      detach,
      downloadReport,
      settings,
      reportTypes,
      distributions,
      loadGenerators,
    };
  },

  isOptionEnabled: (option) => {
    if (!option) {
      return false;
    }

    const trueValues = ['true', 'yes', 'y', '1', 'enabled'];
    return trueValues.includes(option.toString().toLowerCase());
  },

  /**
   *
   * @param runData {
   *         urlObject: any,
   *         tenant: any,
   *         projectId: any,
   *         runId: any,
   *         testId: any,
   *         testName: any,
   *         artifacts_folder: any,
   *         isLocalTesting: any,
   *         uiStatus: any,
   *         startTime: any,
   *         endTime: any
   *     }
   * @return {Promise<void>}
   */
  generateJUnitXmlReport: async (runData) => {
    const jsonTemplate = `{
        "testsuite": {
          "properties": {
            "property": [
              {
                "@name": "generator",
                "@value": "LoadRunner Cloud"
              },
              {
                "@name": "testId",
                "@value": "<%= testId %>"
              },
              {
                "@name": "runId",
                "@value": "<%= runId %>"
              },
              {
                "@name": "reportUrl",
                "@value": "<%= reportUrl %>"
              },
              {
                "@name": "dashboardUrl",
                "@value": "<%= dashboardUrl %>"
              }
            ]
          },
          "testcase": {
            "@classname": "com.microfocus.lrc.Test",
            "@name": "<%= testName %>",
            "@status": "<%= uiStatus %>",
            "@time": "<%= time %>"
          },
          "@failures": "<%= failures %>",
          "@name": "<%= testName %>",
          "@tests": "1"
        }
      }`;

    const {
      urlObject,
      tenant,
      projectId,
      testId,
      testName,
      runId,
      isLocalTesting,
      artifacts_folder,
      uiStatus,
      startTime,
      endTime,
    } = runData;
    const reportUrl = getReportUrl(urlObject, tenant, projectId, runId, isLocalTesting);
    const dashboardUrl = getDashboardUrl(urlObject, tenant, projectId, runId, isLocalTesting);
    const resultPath = path.join(artifacts_folder, `./results_run_${runId}.xml`);

    const jsonTemplateFunc = _.template(jsonTemplate);
    let duration = 0;
    if ((startTime !== -1) && (endTime !== -1) && (endTime > startTime)) {
      duration = (endTime - startTime) / 1000.0;
    }

    const metadata = {
      testId,
      testName,
      runId,
      reportUrl,
      dashboardUrl,
      uiStatus,
      failures: (uiStatus !== 'PASSED' ? 1 : 0),
      time: duration.toFixed(2),
    };

    const resultStr = jsonTemplateFunc(metadata);
    const xml = xmlbuilder.create(JSON.parse(resultStr), { encoding: 'UTF-8' }).end({ pretty: true });
    await fs.promises.writeFile(resultPath, xml);
  },

  validateReportType: (reportTypes) => {
    const TYPES = ['pdf', 'docx', 'csv', 'error-csv', 'raw-transactions'];
    return _.every(reportTypes, (type) => TYPES.includes(type));
  },

  // without "."
  getFileExtensionByReportType: (reportType) => {
    const TYPES_MAPPING = {
      pdf: 'pdf',
      docx: 'docx',
      csv: 'csv',
      'error-csv': 'error.csv',
      'raw-transactions': 'raw.zip',
    };

    return TYPES_MAPPING[reportType] || 'dat';
  },

  createLogger: () => {
    const {
      combine, timestamp, printf,
    } = winston.format;

    return winston.createLogger({
      format: combine(
        timestamp(),
        printf(({
          level,
          message,
          // eslint-disable-next-line no-shadow
          timestamp,
        }) => `${timestamp} - ${level}: ${message}`),
      ),
      transports: [new winston.transports.Console()],
    });
  },

};

module.exports = utils;
