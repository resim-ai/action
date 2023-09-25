const core = require('@actions/core');
const github = require('@actions/github');
const axios = require("axios");
const fs = require('fs');
const cache = require('@actions/cache');
const { v4: uuidv4 } = require('uuid');
const { debug } = require('console');

const tokencachepath = '.resimtoken';
const api_endpoint = core.getInput('api_endpoint');
const auth0_tenant_url = core.getInput('auth0_tenant_url');
const client_id = core.getInput('client_id');
const client_secret = core.getInput('client_secret');

let debugLogging = false;
let resimToken = "";

const debugLog = (message) => {
  if (debugLogging) {
    if (typeof message === 'object') {
      console.dir(message)
    } else {
      core.info(message)
    }
  }
}

const checkAuthToken = async () => {
  debugLog("Checking auth token")

  let tokenValid = false;

  let options = {
    method: 'GET',
    url: `${api_endpoint}projects`,
    headers: { Authorization: `Bearer ${resimToken}` },
    validateStatus: function (status) {
      return status >= 200 && status < 500; // default is < 300, but we want to continue if we get a 401
    },
  }
  await axios.request(options).then(function (response) {
    debugLog(`token check status: ${response.status}`)
    if (response.status >= "200" && response.status < 300) {
      tokenValid = true
    }
  })

  return tokenValid;
}

const getAuthToken = async () => {
  console.log("Getting auth token from cache or auth0")

  let cacheRestored = false
  let tokenValid = false

  try {
    const cacheKey = await cache.restoreCache([".resimtoken"], "", ["resim-token-"])
    if (!cacheKey) {
      debugLog("Couldn't restore cached token");
    } else {
      debugLog(`Restored cache from key: ${cacheKey}`);
      cacheRestored = true
    }
  } catch (error) {
    console.warn(error);
  }

  if (cacheRestored) {
    resimToken = fs.readFileSync('.resimtoken', 'utf8');
    tokenValid = await checkAuthToken();
  };

  if (!cacheRestored || !tokenValid) {
    debugLog("Fetching new token")
    let options = {
      method: 'POST',
      url: `${auth0_tenant_url}oauth/token`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client_id,
        client_secret: client_secret,
        audience: 'https://api.resim.ai'
      })
    };

    await axios.request(options).then(function (response) {
      debugLog(response.data)
      fs.writeFile(tokencachepath, response.data.access_token, function (err) {
        if (err) {
          return debugLog(err);
        }
        debugLog("Wrote token to .resimtoken");
      });

      resimToken = response.data.access_token

      let cacheKey = `resim-token-${uuidv4()}`
      cacheAuthToken(cacheKey)
    });
  }
}

const cacheAuthToken = (cacheKey) => {
  cache.saveCache([tokencachepath], cacheKey)
}

const launchBatch = async (build, experiences) => {
  const requestBody = {
    BuildID: build,
    ExperienceIDs: experiences.split(",")
  }
  debugLog(requestBody)
  let batchID = '';
  await axios.request({
    method: 'POST',
    url: `${api_endpoint}batches`,
    headers: { Authorization: `Bearer ${resimToken}` },
    data: requestBody
  }).then(function (response) {
    debugLog(response.data)
    batchID = response.data.batchID
  })
  return batchID
}

const main = async () => {
  debugLogging = core.getBooleanInput("debug_logging")
  try {
    await getAuthToken();
    debugLog("Auth configured")

    if (core.getInput("resource") == "batch" && core.getInput("operation") == "create") {
      build = core.getInput("build")
      experiences = core.getInput("experiences")

      let batchID = await launchBatch(build, experiences);
      core.setOutput("batch_id", batchID)

      core.info(`Batch launched: ${batchID}`)

      if (github.context.eventName === 'pull_request' && core.getBooleanInput("comment_on_pr")) {
        const contextPayload = github.context.payload;
        const github_token = core.getInput('github_token');
        const octokit = github.getOctokit(github_token);

        const commentOptions = {
          owner: contextPayload.repository.owner.login,
          repo: contextPayload.repository.name,
          issue_number: contextPayload.pull_request.number,
          body: `[View results on ReSim](https://app.resim.ai/results/${batchID})`
        }
        debugLog(commentOptions)
        await octokit.rest.issues.createComment(commentOptions);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();