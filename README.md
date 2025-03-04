[![CodeQL](https://github.com/MicroFocus/lrcrunner/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/MicroFocus/lrcrunner/actions/workflows/github-code-scanning/codeql)

# Command line test runner for LoadRunner Cloud

This tool allows you to easily create / configure test, run test and download reports.  
It utilizes LoadRunner Cloud's [Public APIs](https://admhelp.microfocus.com/lrc/en/Latest/Content/Storm/PublicAPIs.htm).

### Requirements

- [**Node.js** `v16`](https://nodejs.org/en/download/) or higher must be installed to run this program. Latest LTS version is recommended.

### Installation

```bash
npm install -g --no-save --production https://github.com/SPHTech-Platform/lrcrunner
```

### Usage

## Command line parameters

```bash
Options:
  -v, --version                        print version
  -r, --run [config file]              run with specified configuration file (default: "")
  -u, --url [url]                      LRC url
  -a, --artifacts [folder]             artifacts folder
  -i, --client_id [client id]          LRC client id
  -s, --client_secret [client secret]  LRC client secret
  -t, --tenant [tenant id]             LRC tenant id
  -h, --help                           display help for command

```

Example command for SPH account:
```bash
lrcrunner -r demo/myTest.yml -u https://loadrunner-cloud.saas.microfocus.com -i <ID> -s <Secret> -t 695831988
```


Above client id and client secret can also be specified via environment variables: LRC_CLIENT_ID and LRC_CLIENT_SECRET.  
Refer to https://admhelp.microfocus.com/lrc/en/Latest/Content/Storm/Admin-APIAccess.htm for details about API access
keys.

## Test configuration file

Test configuration file is in YAML format. Refer to sample/lrc_iterations_hybrid.yml

```yaml
scenarios:
  test:
    projectId: 1 # project Id
    #testId: 11            # run existing test instead of creating new one
    name: demo test # test name
    runTest: true # run created test. ignored when testId is specified
    detach: false # don't wait until test run is completed
    downloadReport: true # download report after test run
    reportType: pdf # pdf, csv, docx, error-csv, raw-transactions (default: pdf). to download multiple report, use an array. for example: [csv, pdf]
    settings:
      description: my test # test description
      licenseMode: 0 # license modes: "VUH": 0, "VU": 1, "Mixed VU / VUH": 2
      runMode: 1 # run modes: "Duration": 0, "Iterations": 1, "Goal Oriented": 2
    scripts:
      - vusersNum: 10
        path: ./scripts/web test.zip # path to your script
        #id: 1                           # use existing script
        startTime: 0
        schedulingMode: simple # simple , manual , advanced
        rampUp:
          duration: 10
          interval: 0
          vusers: 10
        duration: 120
        tearDown:
          duration: 10
          interval: 0
          vusers: 10
        locationType: 0 # 0: Cloud; 1: On-Premise
        iterations: 5 #
        maxDuration: 300

      - path: ./scripts/simple_test.zip
        vusersNum: 5
        startTime: 0
        schedulingMode: simple # simple, manual, advanced
        rampUp:
          duration: 0
          interval: 0
          vusers: 5
        duration: 120
        tearDown:
          duration: 0
          interval: 0
          vusers: 5
        locationType: 1 # 0: Cloud; 1: On-Premise
        iterations: 5 #
        maxDuration: 300

    distributions: # specify Vusers distributions for Cloud
      - locationName: aws-ap-southeast-1 # SG
        vusersPercent: 80 # (%)
      - locationName: aws-ap-east-1 # HK
        vusersPercent: 10 # (%)
      - locationName: aws-ap-southeast-2 # Sydney
        vusersPercent: 10 # (%)

    loadGenerators: # on-premises load generators
      - 03ff1bff9d8653d24451 # assign on-premises load generator to test by its key
      - 88dded94103e71343fca

modules:
  lrc:
    #tenant: 12345678    # LRC tenant id

settings:
  proxy:
    #address: http://<PROXY HOST>:<PROXY PORT>  # specify web proxy if it's needed
```
