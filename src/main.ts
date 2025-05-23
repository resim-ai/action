import * as core from '@actions/core'
import * as github from '@actions/github'
import type { AxiosResponse } from 'axios'
import * as auth from './auth'
import {
  Batch,
  BatchesApi,
  BatchInput,
  BuildsApi,
  Configuration,
  ProjectsApi,
  SystemsApi,
  TestSuiteBatchInput,
  TriggeredVia,
  TestSuitesApi
} from './client'

import { findOrCreateBranch, getProjectID } from './projects'
import { getSystemID } from './systems'
import { getTestSuiteID } from './test_suites'

import { WebhookPayload } from '@actions/github/lib/interfaces'
import 'axios-debug-log'
import { createBuild } from './builds'
const debug = core.debug

const SUPPORTED_EVENTS = [
  'pull_request',
  'push',
  'schedule',
  'workflow_dispatch'
]

const API_TO_APP_URL: Record<string, string> = {
  'https://api.resim.ai/v1': 'https://app.resim.ai',
  'https://api.resim.io/v1': 'https://app.resim.io'
}

type CommonBatchInput =
  | TestSuiteBatchInput
  | (BatchInput & {
      buildID: string // force buildId to be set
    })

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const apiEndpoint = core.getInput('api_endpoint')

    if (
      core.getInput('test_suite') !== '' &&
      (core.getInput('experience_tags') !== '' ||
        core.getInput('experiences') !== '' ||
        core.getInput('metrics_build_id') !== '')
    ) {
      core.setFailed(
        'Cannot set test_suite with experience_tags, experiences, or metrics_build_id'
      )
      return
    }

    if (
      core.getInput('test_suite') === '' &&
      core.getInput('experience_tags') === '' &&
      core.getInput('experiences') === ''
    ) {
      core.setFailed(
        'Must set at least one of experiences or experience_tags when not setting test_suite'
      )
      return
    }

    if (core.getInput('project') === '') {
      core.setFailed('Must set project name')
      return
    }

    // Validate batch parameters
    let allowableFailurePercent: number | undefined = parseInt(
      core.getInput('allowable_failure_percent')
    )
    allowableFailurePercent = isNaN(allowableFailurePercent)
      ? undefined
      : allowableFailurePercent
    if (
      allowableFailurePercent !== undefined &&
      (allowableFailurePercent < 0 || allowableFailurePercent > 100)
    ) {
      core.setFailed('allowable_failure_percent must be between 0 and 100')
      return
    }

    const poolLabels: string[] | undefined =
      core.getInput('pool_labels') !== ''
        ? core.getInput('pool_labels').split(',')
        : undefined
    if (poolLabels?.includes('resim')) {
      core.setFailed('resim is a reserved pool label')
      return
    }

    // parse parameters to kv pairs
    const parameters: Record<string, string> = {}
    if (core.getInput('parameters') !== '') {
      const parameterPairs = core.getInput('parameters').split(',')
      for (let pair of parameterPairs) {
        pair = pair.trim()
        if (!pair) continue // skip empty
        if (!pair.includes('=')) {
          debug(`Ignoring parameter entry without '=': '${pair}'`)
          continue
        }
        const [key, value, ...rest] = pair.split('=')
        if (rest.length > 0) {
          debug(`Ignoring parameter entry with extra '=': '${pair}'`)
          continue
        }
        if (!key) {
          debug(`Ignoring parameter entry with empty key: '${pair}'`)
          continue
        }
        parameters[key] = value
      }
    }

    const token = await auth.getToken()
    debug('got auth')
    if (token === 'ERROR') {
      core.setFailed('Please set client credentials or username and password')
      return
    }

    const config = new Configuration({
      basePath: apiEndpoint,
      accessToken: token
    })

    if (!SUPPORTED_EVENTS.includes(github.context.eventName)) {
      core.setFailed(
        `The event triggering this action must be one of [${SUPPORTED_EVENTS.join(', ')}]`
      )
      return
    }

    const imageUri = core.getInput('image')
    debug(`imageUri is ${imageUri}`)

    const projectsApi = new ProjectsApi(config)

    const projectID = await getProjectID(projectsApi, core.getInput('project'))
    debug(`project ID is ${projectID}`)

    const systemName = core.getInput('system')
    debug(`systemName is ${systemName}`)
    const systemsApi = new SystemsApi(config)
    const systemID = await getSystemID(systemsApi, projectID, systemName)
    debug(`system ID is ${systemID}`)

    let associatedAccount = undefined
    if (process.env.GITHUB_ACTOR !== undefined) {
      associatedAccount = process.env.GITHUB_ACTOR
    }
    debug(`associatedAccount is ${associatedAccount}`)

    let branchName = ''
    if (process.env.GITHUB_REF_NAME !== undefined) {
      branchName = process.env.GITHUB_REF_NAME
    }
    if (
      process.env.GITHUB_EVENT_NAME === 'pull_request' &&
      process.env.GITHUB_HEAD_REF !== undefined
    ) {
      branchName = process.env.GITHUB_HEAD_REF
    }
    debug(`branchName is ${branchName}`)

    const branchID = await findOrCreateBranch(
      projectsApi,
      projectID,
      branchName
    )

    let buildDescription = ''
    let shortCommitSha = ''
    if (github.context.eventName === 'pull_request') {
      if (github.context.payload.pull_request !== undefined) {
        const pullRequestEvent = github.context.payload.pull_request
        debug(pullRequestEvent.head)
        shortCommitSha = pullRequestEvent.head.sha.slice(0, 8)
        buildDescription = `#${pullRequestEvent.number} - ${pullRequestEvent.title}`
      }
    } else if (github.context.eventName === 'push') {
      if (github.context.payload !== undefined) {
        const pushRequestEvent = github.context.payload
        debug(pushRequestEvent.after)
        // Set the shortCommitSha as the first commit and set the description as 'Push to <branch> @ sha'
        shortCommitSha = pushRequestEvent.after.slice(0, 8)
        buildDescription = `Push to ${branchName} @ ${shortCommitSha}`
      }
    } else if (github.context.eventName === 'schedule') {
      debug(github.context.sha)
      // Set the shortCommitSha as the first commit and set the description as 'Scheduled run of <branch> @ sha'
      shortCommitSha = github.context.sha.slice(0, 8)
      buildDescription = `Scheduled run of ${branchName} @ ${shortCommitSha}`
    } else if (github.context.eventName === 'workflow_dispatch') {
      // Set the shortCommitSha as the first commit and set the description as 'Manual run of <branch> @ sha'
      debug(github.context.sha)
      shortCommitSha = github.context.sha.slice(0, 8)
      buildDescription = `Manual run of ${branchName} @ ${shortCommitSha}`
    }

    // register build
    const buildsApi = new BuildsApi(config)
    const newBuild = await createBuild(
      buildsApi,
      projectID,
      branchID,
      systemID,
      imageUri,
      buildDescription,
      shortCommitSha
    )
    debug(`build created: ${JSON.stringify(newBuild)}`)

    if (newBuild.buildID === undefined) {
      core.setFailed('Could not obtain build id')
      return
    }

    const batchInput: CommonBatchInput = {
      buildID: newBuild.buildID,
      triggeredVia: TriggeredVia.Github,
      associatedAccount,
      allowableFailurePercent,
      poolLabels,
      parameters
    }

    const batchesApi = new BatchesApi(config)
    const testSuitesApi = new TestSuitesApi(config)
    // A variable to be the new batch id depending on whether we do a test suite run
    // or a standard batch (a string or undefined):
    let newBatchID: string | undefined = undefined

    // If test suite is set
    if (core.getInput('test_suite') !== '') {
      const testSuiteName = core.getInput('test_suite')

      // Obtain the test suite ID
      const testSuiteID = await getTestSuiteID(
        testSuitesApi,
        projectID,
        testSuiteName
      )
      debug(`test suite ID is ${testSuiteID}`)

      const newBatchResponse: AxiosResponse<Batch> =
        await batchesApi.createBatchForTestSuite(
          projectID,
          testSuiteID,
          batchInput
        )

      const newBatch: Batch = newBatchResponse.data
      debug(`batch launched: ${JSON.stringify(newBatch)}`)

      newBatchID = newBatch.batchID
    } else {
      const batchRequest: BatchInput = batchInput

      if (core.getInput('experience_tags') !== '') {
        const experienceTagNames = arrayInputSplit(
          core.getInput('experience_tags')
        )
        batchRequest.experienceTagNames = experienceTagNames
      }

      if (core.getInput('experiences') !== '') {
        const experienceNames = arrayInputSplit(core.getInput('experiences'))
        batchRequest.experienceNames = experienceNames
      }

      if (core.getInput('metrics_build_id') !== '') {
        const metricsBuildID = core.getInput('metrics_build_id')
        batchRequest.metricsBuildID = metricsBuildID
      }

      debug(`built BatchInput: ${JSON.stringify(batchRequest)}`)
      const newBatchResponse: AxiosResponse<Batch> =
        await batchesApi.createBatch(projectID, batchRequest)

      const newBatch: Batch = newBatchResponse.data
      debug(`batch launched: ${JSON.stringify(newBatch)}`)

      newBatchID = newBatch.batchID
    }

    core.info(`Launched batch ${newBatchID}`)
    const appUrl = API_TO_APP_URL[core.getInput('api_endpoint')]
    if (appUrl !== undefined) {
      core.info(
        `View results on ReSim: ${appUrl}/projects/${projectID}/batches/${newBatchID}`
      )
      core.summary.addLink(
        'View results on ReSim',
        `${appUrl}/projects/${projectID}/batches/${newBatchID}`
      )
      core.summary.write()
    }

    if (
      github.context.eventName === 'pull_request' &&
      core.getBooleanInput('comment_on_pr')
    ) {
      const contextPayload: WebhookPayload = github.context.payload
      const github_token = core.getInput('github_token')
      const octokit = github.getOctokit(github_token)

      const commentOptions = {
        issue_number: 0,
        body: `Batch ${newBatchID} launched`,
        owner: '',
        repo: ''
      }

      if (appUrl !== undefined) {
        commentOptions.body = `[View results on ReSim](${appUrl}/projects/${projectID}/batches/${newBatchID})`
      }

      if (contextPayload.pull_request !== undefined) {
        commentOptions.issue_number = contextPayload.pull_request.number
      }

      if (contextPayload.repository !== undefined) {
        commentOptions.owner = contextPayload.repository.owner.login
        commentOptions.repo = contextPayload.repository.name
      }

      debug(JSON.stringify(commentOptions))
      await octokit.rest.issues.createComment(commentOptions)
    }

    // set outputs for downstream steps
    core.setOutput('project_id', projectID)
    core.setOutput('batch_id', newBatchID)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      debug(`Workflow failed: ${JSON.stringify(error)}`)
      core.setFailed(error.message)
    }
  }
}

export function arrayInputSplit(input: string): string[] {
  return input.split(',').map(item => {
    let trimmed = item.trim()
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1)
    }
    return trimmed
  })
}
