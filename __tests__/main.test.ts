import * as auth from '../src/auth'
import * as main from '../src/main'

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as uuid from 'uuid'

import type { AxiosResponse } from 'axios'
import { Batch, BatchesApi, Build } from '../src/client'
import * as projects from '../src/projects'
import * as systems from '../src/systems'
import * as test_suites from '../src/test_suites'

import * as builds from '../src/builds'

const getInputMock = jest.spyOn(core, 'getInput')
const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')
const setFailedMock = jest.spyOn(core, 'setFailed')
const setOutputMock = jest.spyOn(core, 'setOutput')

const getProjectIDMock = jest.spyOn(projects, 'getProjectID')
const findOrCreateBranchMock = jest.spyOn(projects, 'findOrCreateBranch')
const createBranchMock = jest.spyOn(projects, 'createBranch')

const getSystemIDMock = jest.spyOn(systems, 'getSystemID')
const getTestSuiteIDMock = jest.spyOn(test_suites, 'getTestSuiteID')
const createBuildMock = jest.spyOn(builds, 'createBuild')

const defaultInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
    case 'auth0_tenant_url':
      return 'https://resim-dev.us.auth0.com/'
    case 'client_id':
      return 'ID'
    case 'client_secret':
      return 'secret'
    case 'experience_tags':
      return 'tag1,tag2'
    case 'image':
      return 'a.docker/image:tag'
    case 'project':
      return 'a-resim-project'
    case 'system':
      return 'a-resim-system'
    case 'metrics_build_id':
      return 'metrics-build-id'
    default:
      return ''
  }
}

const noExperienceInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
    case 'project':
      return 'a-project'
    default:
      return ''
  }
}

const testSuiteInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
    case 'auth0_tenant_url':
      return 'https://resim-dev.us.auth0.com/'
    case 'client_id':
      return 'ID'
    case 'client_secret':
      return 'secret'
    case 'test_suite':
      return 'my_test'
    case 'image':
      return 'a.docker/image:tag'
    case 'project':
      return 'a-resim-project'
    case 'system':
      return 'a-resim-system'
    default:
      return ''
  }
}

const badTestSuiteInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
    case 'auth0_tenant_url':
      return 'https://resim-dev.us.auth0.com/'
    case 'client_id':
      return 'ID'
    case 'client_secret':
      return 'secret'
    case 'test_suite':
      return 'my_test'
    case 'experience_tags':
      return 'tag1,tag2'
    case 'image':
      return 'a.docker/image:tag'
    case 'project':
      return 'a-resim-project'
    case 'system':
      return 'a-resim-system'
    default:
      return ''
  }
}

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the auth functions
const getTokenMock = jest.spyOn(auth, 'getToken')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // manually specify for local testing, as it's set in CI
    process.env.GITHUB_REF_NAME = 'main'
  })

  it('fails if neither experiences nor experience_tags is set', async () => {
    getInputMock.mockImplementation(noExperienceInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalled()
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('fails if both experiences and test suites are set', async () => {
    getInputMock.mockImplementation(badTestSuiteInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalled()
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('can handle array inputs with or without quotes', async () => {
    expect(main.arrayInputSplit('"one two",three four')).toEqual([
      'one two',
      'three four'
    ])

    expect(main.arrayInputSplit("'one two', three four")).toEqual([
      'one two',
      'three four'
    ])
  })

  it('launches a  batch, branch already exists', async () => {
    getInputMock.mockImplementation(defaultInput)
    getBooleanInputMock.mockReturnValue(false)

    const projectID = uuid.v4()
    const systemID = uuid.v4()
    const branchID = uuid.v4()
    const userID = uuid.v4()
    const buildID = uuid.v4()

    const orgID = 'resim.ai'
    const imageUri = 'a.docker/image:tag'
    const version = '0.0.1'
    const associatedAccount: string = process.env.GITHUB_ACTOR ?? ''
    const buildSpecification = 'buildSpecification'
    const creationTimestamp = '2021-01-01T00:00:00.000Z'
    const description = 'some build'
    const longDescription = ''
    const name = 'some build name'

    getTokenMock.mockImplementation(async (): Promise<string> => {
      return Promise.resolve('token')
    })

    getProjectIDMock.mockResolvedValueOnce(projectID)
    getSystemIDMock.mockResolvedValueOnce(systemID)

    // pretend we're in a PR to test this code path
    process.env.GITHUB_HEAD_REF = 'pr-branch'
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    process.env.GITHUB_ACTOR = 'github-user'
    findOrCreateBranchMock.mockResolvedValueOnce(branchID)

    Object.defineProperty(github, 'context', {
      value: {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              sha: '03403a4f2db7fc85c79c4da80bd3ea719eb8dce5'
            },
            number: 123,
            title: 'Test PR'
          }
        }
      }
    })

    const newBuild: Build = {
      buildID,
      projectID,
      branchID,
      systemID,
      imageUri,
      description,
      version,
      associatedAccount,
      buildSpecification,
      creationTimestamp,
      longDescription,
      userID,
      orgID,
      name
    }
    createBuildMock.mockResolvedValueOnce(newBuild)

    const batchID = uuid.v4()
    const newBatch: Batch = {
      associatedAccount,
      batchID
    }

    const createBatchMock = jest
      .spyOn(BatchesApi.prototype, 'createBatch')
      .mockResolvedValueOnce({ data: newBatch } as AxiosResponse)

    await main.run()

    expect(getProjectIDMock).toHaveBeenCalledTimes(1)
    expect(getSystemIDMock).toHaveBeenCalledTimes(1)
    expect(createBranchMock).not.toHaveBeenCalled()
    expect(createBatchMock).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveReturned()
    expect(getTokenMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('project_id', projectID)
    expect(setOutputMock).toHaveBeenCalledWith('batch_id', batchID)
  })

  it('runs a test suite, branch already exists', async () => {
    getInputMock.mockImplementation(testSuiteInput)
    getBooleanInputMock.mockReturnValue(false)

    const branchID = uuid.v4()
    const projectID = uuid.v4()
    const systemID = uuid.v4()
    const buildID = uuid.v4()
    const batchID = uuid.v4()
    const testSuiteID = uuid.v4()
    const userID = uuid.v4()
    const orgID = 'resim.ai'
    const imageUri = 'a.docker/image:tag'
    const version = '0.0.1'
    const associatedAccount: string = process.env.GITHUB_ACTOR ?? ''
    const buildSpecification = 'buildSpecification'
    const creationTimestamp = '2021-01-01T00:00:00.000Z'
    const description = 'some build'
    const longDescription = ''
    const name = 'some build name'

    getTokenMock.mockImplementation(async (): Promise<string> => {
      return Promise.resolve('token')
    })

    getProjectIDMock.mockResolvedValueOnce(projectID)
    getSystemIDMock.mockResolvedValueOnce(systemID)
    getTestSuiteIDMock.mockResolvedValueOnce(testSuiteID)

    // pretend we're in a PR to test this code path
    process.env.GITHUB_HEAD_REF = 'pr-branch'
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    process.env.GITHUB_ACTOR = 'github-user'
    findOrCreateBranchMock.mockResolvedValueOnce(branchID)

    Object.defineProperty(github, 'context', {
      value: {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              sha: '03403a4f2db7fc85c79c4da80bd3ea719eb8dce5'
            },
            number: 123,
            title: 'Test PR'
          }
        }
      }
    })

    const newBuild: Build = {
      buildID,
      projectID,
      branchID,
      systemID,
      imageUri,
      description,
      version,
      associatedAccount,
      buildSpecification,
      creationTimestamp,
      longDescription,
      userID,
      orgID,
      name
    }
    createBuildMock.mockResolvedValueOnce(newBuild)

    const newBatch: Batch = {
      associatedAccount,
      batchID
    }

    const testSuiteBatchInputMock = jest
      .spyOn(BatchesApi.prototype, 'createBatchForTestSuite')
      .mockResolvedValueOnce({ data: newBatch } as AxiosResponse)

    await main.run()

    expect(getProjectIDMock).toHaveBeenCalledTimes(1)
    expect(getSystemIDMock).toHaveBeenCalledTimes(1)
    expect(getTestSuiteIDMock).toHaveBeenCalledTimes(1)
    expect(createBranchMock).not.toHaveBeenCalled()
    expect(testSuiteBatchInputMock).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveReturned()
    expect(getTokenMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('project_id', projectID)
    expect(setOutputMock).toHaveBeenCalledWith('batch_id', batchID)
  })

  it('launches a batch with pool labels and allowable failure percent', async () => {
    const customInput = (name: string): string => {
      switch (name) {
        case 'api_endpoint':
          return 'https://api.resim.io/v1/'
        case 'auth0_tenant_url':
          return 'https://resim-dev.us.auth0.com/'
        case 'client_id':
          return 'ID'
        case 'client_secret':
          return 'secret'
        case 'experience_tags':
          return 'tag1,tag2'
        case 'image':
          return 'a.docker/image:tag'
        case 'project':
          return 'a-resim-project'
        case 'system':
          return 'a-resim-system'
        case 'pool_labels':
          return 'gpu,high-memory'
        case 'allowable_failure_percent':
          return '25'
        default:
          return ''
      }
    }

    getInputMock.mockImplementation(customInput)
    getBooleanInputMock.mockReturnValue(false)

    const projectID = uuid.v4()
    const systemID = uuid.v4()
    const branchID = uuid.v4()
    const userID = uuid.v4()
    const buildID = uuid.v4()

    const orgID = 'resim.ai'
    const imageUri = 'a.docker/image:tag'
    const version = '0.0.1'
    const associatedAccount: string = process.env.GITHUB_ACTOR ?? ''
    const buildSpecification = 'buildSpecification'
    const creationTimestamp = '2021-01-01T00:00:00.000Z'
    const description = 'some build'
    const longDescription = ''
    const name = 'some build name'

    getTokenMock.mockImplementation(async (): Promise<string> => {
      return Promise.resolve('token')
    })

    getProjectIDMock.mockResolvedValueOnce(projectID)
    getSystemIDMock.mockResolvedValueOnce(systemID)

    process.env.GITHUB_HEAD_REF = 'pr-branch'
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    process.env.GITHUB_ACTOR = 'github-user'
    findOrCreateBranchMock.mockResolvedValueOnce(branchID)

    Object.defineProperty(github, 'context', {
      value: {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              sha: '03403a4f2db7fc85c79c4da80bd3ea719eb8dce5'
            },
            number: 123,
            title: 'Test PR'
          }
        }
      }
    })

    const newBuild: Build = {
      buildID,
      projectID,
      branchID,
      systemID,
      imageUri,
      description,
      version,
      associatedAccount,
      buildSpecification,
      creationTimestamp,
      longDescription,
      userID,
      orgID,
      name
    }
    createBuildMock.mockResolvedValueOnce(newBuild)

    const batchID = uuid.v4()
    const newBatch: Batch = {
      associatedAccount,
      batchID
    }

    const createBatchMock = jest
      .spyOn(BatchesApi.prototype, 'createBatch')
      .mockResolvedValueOnce({ data: newBatch } as AxiosResponse)

    await main.run()

    expect(getProjectIDMock).toHaveBeenCalledTimes(1)
    expect(getSystemIDMock).toHaveBeenCalledTimes(1)
    expect(createBranchMock).not.toHaveBeenCalled()
    expect(createBatchMock).toHaveBeenCalledTimes(1)
    expect(createBatchMock).toHaveBeenCalledWith(
      projectID,
      expect.objectContaining({
        allowableFailurePercent: 25,
        poolLabels: ['gpu', 'high-memory']
      })
    )
    expect(runMock).toHaveReturned()
    expect(getTokenMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('project_id', projectID)
    expect(setOutputMock).toHaveBeenCalledWith('batch_id', batchID)
  })

  it('fails when pool labels include reserved label', async () => {
    const customInput = (name: string): string => {
      switch (name) {
        case 'api_endpoint':
          return 'https://api.resim.io/v1/'
        case 'project':
          return 'a-project'
        case 'experience_tags':
          return 'tag1'
        case 'pool_labels':
          return 'gpu,resim,high-memory'
        default:
          return ''
      }
    }

    getInputMock.mockImplementation(customInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith('resim is a reserved pool label')
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('fails when allowable failure percent is invalid', async () => {
    const customInput = (name: string): string => {
      switch (name) {
        case 'api_endpoint':
          return 'https://api.resim.io/v1/'
        case 'project':
          return 'a-project'
        case 'experience_tags':
          return 'tag1'
        case 'allowable_failure_percent':
          return '101'
        default:
          return ''
      }
    }

    getInputMock.mockImplementation(customInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'allowable_failure_percent must be between 0 and 100'
    )
    expect(getTokenMock).not.toHaveBeenCalled()
  })
})
