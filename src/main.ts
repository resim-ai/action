import * as core from '@actions/core'
import * as github from '@actions/github'
import * as auth from './auth'
import {
  Configuration,
  Batch,
  BatchesApi,
  CreateBatchRequest,
  ProjectsApi,
  Project,
  BuildsApi
} from './client'
import type { AxiosResponse } from 'axios'

import { getBranchID, getLatestProject, createBranch } from './projects'

import 'axios-debug-log'
import Debug from 'debug'
import { createBuild } from './builds'
const debug = Debug('action')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const apiEndpoint = core.getInput('api_endpoint')
    const buildID = core.getInput('build')
    const experienceTagNames = arrayInputSplit(core.getInput('experience_tags'))
    debug('got inputs')

    const token = await auth.getToken()
    debug('got auth')

    const config = new Configuration({
      basePath: apiEndpoint,
      accessToken: token
    })

    const imageUri = core.getInput('image')
    console.log(`imageUri is ${imageUri}`)

    const projectsApi = new ProjectsApi(config)

    // if project input isn't set, get the newest project
    let projectID: string = ''
    if (core.getInput('project') !== '') {
      projectID = core.getInput('project')
    } else {
      const project = await getLatestProject(projectsApi)
      if (project.projectID !== undefined) {
        projectID = project?.projectID
      }
    }
    if (projectID === '') {
      core.setFailed('Could not find project ID')
    }

    console.log(`projectID is ${projectID}`)

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

    console.log(`branchName is ${branchName}`)

    let branchID = await getBranchID(projectsApi, projectID, branchName)
    if (branchID === '') {
      branchID = await createBranch(projectsApi, projectID, branchName)
      console.log('created branch')
    } else {
      console.log(`branch exists, ${branchID}`)
    }

    let buildDescription = ''
    if (github.context.eventName === 'pull_request') {
      if (github.context.payload.pull_request !== undefined) {
        const pullRequestEvent = github.context.payload.pull_request
        debug(pullRequestEvent.head)
        buildDescription = pullRequestEvent.head.sha
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
      // shortCommitSha
      '0.0.1'
    )
    debug(newBuild)

    const batchesApi = new BatchesApi(config)
    const batchRequest: CreateBatchRequest = {
      buildID,
      experienceTagNames
    }
    debug('batchRequest exists')
    const newBatchResponse: AxiosResponse<Batch> =
      await batchesApi.createBatch(batchRequest)

    // comment on PR

    const newBatch: Batch = newBatchResponse.data
    debug('batch launched')
    core.info(JSON.stringify(newBatch))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function arrayInputSplit(input: string): string[] {
  return input.split(',').map(item => item.trim())
}
