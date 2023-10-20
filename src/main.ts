import * as core from '@actions/core'
import * as github from '@actions/github'
import * as auth from './auth'
import {
  Configuration,
  Batch,
  BatchesApi,
  CreateBatchRequest,
  ProjectsApi,
  BuildsApi
} from './client'
import type { AxiosResponse } from 'axios'

import { getProjectID, findOrCreateBranch } from './projects'

import 'axios-debug-log'
import Debug from 'debug'
import { createBuild } from './builds'
import { WebhookPayload } from '@actions/github/lib/interfaces'
const debug = Debug('action')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const apiEndpoint = core.getInput('api_endpoint')

    if (
      core.getInput('experience_tags') === '' &&
      core.getInput('experiences') === ''
    ) {
      core.setFailed('Must set at least one of experiences or experience_tags')
      return
    }

    if (core.getInput('project') === '') {
      core.setFailed('Must set project name')
      return
    }

    const token = await auth.getToken()
    debug('got auth')

    const config = new Configuration({
      basePath: apiEndpoint,
      accessToken: token
    })

    const imageUri = core.getInput('image')
    debug(`imageUri is ${imageUri}`)

    const projectsApi = new ProjectsApi(config)

    const projectID = await getProjectID(projectsApi, core.getInput('project'))
    debug(`project ID is ${projectID}`)

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
    }

    // register build
    const buildsApi = new BuildsApi(config)
    const newBuild = await createBuild(
      buildsApi,
      projectID,
      branchID,
      imageUri,
      buildDescription,
      shortCommitSha
    )
    debug(newBuild)

    const batchesApi = new BatchesApi(config)

    const batchRequest: CreateBatchRequest = {
      buildID: newBuild.buildID
    }

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

    debug('batchRequest exists')
    const newBatchResponse: AxiosResponse<Batch> =
      await batchesApi.createBatch(batchRequest)

    const newBatch: Batch = newBatchResponse.data
    debug('batch launched')

    const newBatchID = newBatch.batchID

    core.info(`Launched batch ${newBatchID}`)
    if (core.getInput('api_endpoint') === 'https://api.resim.ai/v1') {
      core.info(
        `View results on ReSim: https://app.resim.ai/results/${newBatchID}`
      )
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

      if (core.getInput('api_endpoint') === 'https://api.resim.ai/v1') {
        commentOptions.body = `[View results on ReSim](https://app.resim.ai/results/${newBatchID})`
      }

      if (contextPayload.pull_request !== undefined) {
        commentOptions.issue_number = contextPayload.pull_request.number
      }

      if (contextPayload.repository !== undefined) {
        commentOptions.owner = contextPayload.repository.owner.login
        commentOptions.repo = contextPayload.repository.name
      }

      debug(commentOptions)
      await octokit.rest.issues.createComment(commentOptions)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
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
