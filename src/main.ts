import * as core from '@actions/core'
import * as auth from './auth'
import { Configuration, Batch, BatchesApi, CreateBatchRequest } from './client'
import type { AxiosResponse } from 'axios'
import 'axios-debug-log'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const apiEndpoint = core.getInput('api_endpoint')
    const token = await auth.getToken()
    const buildID = core.getInput('build')
    const experienceTagNames = arrayInputSplit(core.getInput('experience_tags'))

    const config = new Configuration({
      basePath: apiEndpoint,
      accessToken: token
    })
    const batchApi = new BatchesApi(config)

    const batchRequest: CreateBatchRequest = {
      buildID,
      experienceTagNames
    }

    const newBatchResponse: AxiosResponse<Batch> =
      await batchApi.createBatch(batchRequest)

    const newBatch: Batch = newBatchResponse.data

    core.info(JSON.stringify(newBatch))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function arrayInputSplit(input: string): string[] {
  return input.split(',').map(item => item.trim())
}
