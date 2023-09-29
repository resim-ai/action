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

    const config = new Configuration({
      basePath: apiEndpoint,
      accessToken: token
    })
    const batchApi = new BatchesApi(config)

    const batchRequest: CreateBatchRequest = {
      buildID: '2815ed32-f225-4a92-b8d5-592807a8c475',
      experienceIDs: [
        '449d52fc-a328-46b5-800b-1e1f771525fa',
        '34a7fc66-cfae-4af1-a8ba-f0355f64c8aa'
      ]
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
