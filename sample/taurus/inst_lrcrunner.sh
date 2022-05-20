#!/bin/bash
#
# © Copyright 2022 Micro Focus or one of its affiliates.
# Licensed under the MIT License (the "License");
# you may not use this file except in compliance with the License.
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

echo "LRC_RUNNER_RELEASE_NUMBER: ${LRC_RUNNER_RELEASE_NUMBER}, LRC_RUNNER_PACKAGE: ${LRC_RUNNER_PACKAGE}"

if [ ! -e "/tmp/${LRC_RUNNER_PACKAGE}" ]; then
  echo "installing lrcrunner package from github"
  npm i -g --no-save --production https://github.com/weisun10/lrcrunner/releases/download/${LRC_RUNNER_RELEASE_NUMBER}/${LRC_RUNNER_PACKAGE}
else
  echo "installing lrcrunner package from /tmp"
  npm i -g --no-save --production "/tmp/${LRC_RUNNER_PACKAGE}"
fi

if [ $? != 0 ]; then
  echo "failed to install lrcrunner"
  exit 1
fi

lrcrunner --version

BZT_FOLDER=`find /usr/local/lib -name bzt-configs.json -type f | xargs dirname`
echo ${BZT_FOLDER}

cp /usr/lib/node_modules/lrcrunner/sample/taurus/lrc.py ${BZT_FOLDER}/modules/lrc.py
sed -i '/bzt.modules.gatling.GatlingExecutor$/a\
\  lrc:' ${BZT_FOLDER}/resources/10-base-config.yml
sed -i '/lrc:$/a\
\    class: bzt.modules.lrc.LRCExecutor' ${BZT_FOLDER}/resources/10-base-config.yml
