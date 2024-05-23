import { TestSuite, BatchesApi, ListTestSuiteOutput } from './client'
import type { AxiosResponse } from 'axios'

export async function listTestSuites(
  projectID: string,
  api: BatchesApi
): Promise<TestSuite[]> {
  const testSuites: TestSuite[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListTestSuiteOutput> =
      await api.listTestSuites(projectID, 100, pageToken)
    if (response.data.testSuites) {
      testSuites.push(...response.data.testSuites)
    }
    pageToken = response.data.nextPageToken
  }

  return testSuites
}

export async function getTestSuiteID(
  batchesApi: BatchesApi,
  projectID: string,
  testSuiteName: string
): Promise<string> {
  const suites = await listTestSuites(projectID, batchesApi)
  const thisTestSuite = suites.find(ts => ts.name === testSuiteName)
  if (thisTestSuite?.testSuiteID !== undefined) {
    return thisTestSuite.testSuiteID
  }
  throw new Error(`Could not find test suite ${testSuiteName}`)
}
