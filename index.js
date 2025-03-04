#!/usr/bin/env node

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

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const { program } = require('commander');
const Client = require('./lib/Client');
const utils = require('./lib/utils');
const { version } = require('./package.json');

program.version(version, '-v, --version', 'print version');
program.description(`test executor for LoadRunner Cloud (version: ${version})`)
  .option('-r, --run [config file]', 'run with specified configuration file', '')
  .option('-u, --url [url]', 'LRC url')
  .option('-i, --client_id [client id]', 'LRC client id')
  .option('-s, --client_secret [client secret]', 'LRC client secret')
  .option('-t, --tenant [tenant id]', 'LRC tenant id')
  .option('-a, --artifacts [folder]', 'artifacts folder');
program.parse(process.argv);

const logger = utils.createLogger();

const run = async () => {
  const options = program.opts();

  // load env
  const isLocalTesting = utils.isOptionEnabled(process.env.LRC_LOCAL_TESTING);
  const client_id = options.client_id || process.env.LRC_CLIENT_ID;
  const client_secret = options.client_secret || process.env.LRC_CLIENT_SECRET;
  const artifacts_folder = options.artifacts || path.resolve(process.env.LRC_ARTIFACTS_FOLDER || './results');

  if (!isLocalTesting && (_.isEmpty(client_id) || _.isEmpty(client_secret))) {
    throw new Error('API access keys are missing');
  }

  logger.info(`artifacts folder: ${artifacts_folder}`);
  await fs.ensureDir(artifacts_folder);

  // load config
  const {
    testOpts, lrcCfg, lrcURLObject, proxy,
  } = await utils.loadAndCheckConfig(options, isLocalTesting, logger);

  const tenant = options.tenant || lrcCfg.tenant;
  if (_.isEmpty(tenant) && !_.isInteger(tenant)) {
    throw new Error('tenant is missing');
  }

  logger.info(`LRC url: ${lrcURLObject.href}, tenant: ${tenant}, client id: ${client_id}`);

  // load test options
  const {
    projectId, testId, scripts, name, runTest, detach, downloadReport,
    settings, reportTypes, distributions, loadGenerators,
  } = await utils.loadAndCheckTestOpts(testOpts, logger);

  // start main progress
  const client = new Client(tenant, lrcURLObject, proxy, logger);
  await client.init();
  if (!isLocalTesting) {
    await client.authClient({ client_id, client_secret });
  }

  const runData = {
    urlObject: lrcURLObject,
    tenant,
    projectId,
    artifacts_folder,
    isLocalTesting,
  };

  if (testId) {
    // process #1: run existing test

    logger.info(`test id: ${testId}`);
    const test = await client.getTest(projectId, testId);
    runData.testName = test.name;
    runData.testId = test.id;

    logger.info(`running test: "${runData.testName}" ...`);

    // run test
    const currRun = await client.runTest(projectId, testId);
    runData.runId = currRun.runId;
    logger.info(`run id: ${runData.runId}, url: ${utils.getDashboardUrl(lrcURLObject, tenant, projectId, runData.runId, isLocalTesting)}`);

    // run status and report
    await client.getRunStatusAndResultReport(runData.runId, downloadReport, reportTypes, artifacts_folder);
  } else {
    // process #2: create new test

    // create test
    logger.info(`going to create test: ${name}`);
    const newTest = await client.createTest(projectId, { name });
    runData.testName = newTest.name;
    runData.testId = newTest.id;

    logger.info(`created test. id: ${runData.testId}, name: ${runData.testName}`);

    // test settings
    logger.info('retrieving test settings');
    const newTestSettings = await client.getTestSettings(projectId, newTest.id);
    if (!_.isEmpty(settings)) {
      logger.info('updating test settings');
      await client.updateTestSettings(projectId, newTest.id, _.merge(newTestSettings, settings));
    }

    // test scripts
    logger.info('going to create scripts');
    const allTestScripts = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const script of scripts) {
      let scriptId = script.id;
      if (!scriptId) {
        logger.info(`uploading script: ${script.path} ...`);
        const newScript = await client.uploadScript(projectId, script.path);
        logger.info(`uploaded script. id: ${newScript.id}`);
        scriptId = newScript.id;
      }

      const testScript = await client.addTestScript(projectId, newTest.id, { scriptId });
      logger.info(`added script ${scriptId} into test`);
      testScript.loadTestScriptId = testScript[0].id;
      const json = { ...testScript, ...script };
      const currTestScript = await client.updateTestScript(projectId, newTest.id, json);
      allTestScripts.push(currTestScript);
      logger.info('updated test script settings');
    }

    // vuser distributions
    if (_.find(allTestScripts, (testScript) => testScript.locationType === 0)) { // exist location "Cloud"
      const testLocations = await client.getTestDistributionLocations(projectId, newTest.id);
      // eslint-disable-next-line no-restricted-syntax
      for await (const distribution of distributions) {
        const { locationName, vusersPercent } = distribution;
        const currLocation = _.find(testLocations, { name: locationName });
        if (currLocation) {
          await client.updateTestDistributionLocation(projectId, newTest.id, currLocation.id, { vusersPercent });
          logger.info(`updated vuser distribution: ${locationName} - ${vusersPercent}`);
        } else {
          throw new Error(`location "${locationName}" does not exist`);
        }
      }
    }

    // load generators
    if (_.find(allTestScripts, (testScript) => testScript.locationType === 1)) { // exist location "On-Premise"
      if (loadGenerators.length <= 0) {
        throw new Error('load generators are missing');
      }
      const projectLoadGenerators = await client.getLoadGenerators(projectId) || [];
      // eslint-disable-next-line no-restricted-syntax
      for await (const lgKey of loadGenerators) {
        const currLg = _.find(projectLoadGenerators, (projectLg) => projectLg.key === lgKey);
        if (currLg) {
          await client.assignLgToTest(projectId, newTest.id, currLg.id);
          logger.info(`assigned load generator "${currLg.name}" (${lgKey}) to test`);
        } else {
          throw new Error(`load generator "${lgKey}" does not exist`);
        }
      }
    }

    // run test
    if (!runTest) {
      logger.info('"runTest" flag is not enabled. exit');
      return;
    }
    logger.info(`running test: ${runData.testName} ...`);
    const currRun = await client.runTest(projectId, runData.testId);
    runData.runId = currRun.runId;
    logger.info(`run id: ${runData.runId}, url: ${utils.getDashboardUrl(lrcURLObject, tenant, projectId, runData.runId, isLocalTesting)}`);
    if (detach) {
      logger.info('"detach" flag is enabled. exit');
      return;
    }

    // run status and report
    await client.getRunStatusAndResultReport(runData.runId, downloadReport, reportTypes, artifacts_folder);
  }

  const testRunData = await client.getTestRun(runData.runId);

  runData.uiStatus = testRunData.uiStatus;
  runData.startTime = parseInt(testRunData.startTime, 10) || 0;
  runData.endTime = parseInt(testRunData.endTime, 10) || 0;

  await client.generateJUnitXmlReport(runData);

  logger.info('done');
};

run().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
