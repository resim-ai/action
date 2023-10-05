import * as core from '@actions/core'
import * as auth from './auth'
import {
  Configuration,
  Batch,
  BatchesApi,
  CreateBatchRequest,
  ProjectsApi
} from './client'
import type { AxiosResponse } from 'axios'

import { getLatestProject } from './projects'

import 'axios-debug-log'
import Debug from 'debug'
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
    let project = ''
    if (core.getInput('project') === '') {
      project = await getLatestProject(projectsApi)
    } else {
      project = core.getInput('project')
    }

    console.log(`project is ${project}`)

    // create or find branch
    const branchName = process.env.GITHUB_REF_NAME

    console.log(`branchName is ${branchName}`)

    // register build

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
