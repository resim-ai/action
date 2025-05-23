import { TestSuite, ListTestSuiteOutput, TestSuitesApi } from './client'
import type { AxiosResponse } from 'axios'

export async function listTestSuites(
  projectID: string,
  testSuiteName: string,
  api: TestSuitesApi
): Promise<TestSuite[]> {
  const testSuites: TestSuite[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListTestSuiteOutput> =
      await api.listTestSuites(
        projectID,
        undefined,
        undefined,
        testSuiteName,
        undefined,
        100,
        pageToken
      )
    if (response.data.testSuites) {
      testSuites.push(...response.data.testSuites)
    }
    pageToken = response.data.nextPageToken
  }

  return testSuites
}

export async function getTestSuiteID(
  testSuitesApi: TestSuitesApi,
  projectID: string,
  testSuiteName: string
): Promise<string> {
  const suites = await listTestSuites(projectID, testSuiteName, testSuitesApi)
  const thisTestSuite = suites.find(ts => ts.name === testSuiteName)
  if (thisTestSuite?.testSuiteID !== undefined) {
    return thisTestSuite.testSuiteID
  }
  throw new Error(`Could not find test suite ${testSuiteName}`)
}
