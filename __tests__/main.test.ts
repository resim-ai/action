import * as main from '../src/main'
import * as auth from '../src/auth'

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as uuid from 'uuid'

import type { AxiosResponse } from 'axios'
import { Batch, BatchesApi, Build } from '../src/client'
import * as projects from '../src/projects'
import * as builds from '../src/builds'

const getInputMock = jest.spyOn(core, 'getInput')
const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')
const setFailedMock = jest.spyOn(core, 'setFailed')

const getProjectIDMock = jest.spyOn(projects, 'getProjectID')
const findOrCreateBranchMock = jest.spyOn(projects, 'findOrCreateBranch')
const createBranchMock = jest.spyOn(projects, 'createBranch')

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
      return ''
    default:
      return ''
  }
}

const bothExperienceInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
    case 'experience_tags':
      return 'tag1,tag2'
    case 'experiences':
      return 'exp1,exp2'
    default:
      return ''
  }
}

const noExperienceInput = (name: string): string => {
  switch (name) {
    case 'api_endpoint':
      return 'https://api.resim.io/v1/'
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
  })

  it('fails if both experiences and experience_tags are set', async () => {
    getInputMock.mockImplementation(bothExperienceInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalled()
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('fails if neither experiences nor experience_tags is set', async () => {
    getInputMock.mockImplementation(noExperienceInput)
    setFailedMock.mockImplementation()

    await main.run()

    expect(setFailedMock).toHaveBeenCalled()
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('launches a  batch, branch already exists', async () => {
    getInputMock.mockImplementation(defaultInput)
    getBooleanInputMock.mockReturnValue(false)

    const branchID = uuid.v4()
    const projectID = uuid.v4()
    const buildID = uuid.v4()
    const batchID = uuid.v4()

    getTokenMock.mockImplementation(async (): Promise<string> => {
      return Promise.resolve('token')
    })

    getProjectIDMock.mockResolvedValueOnce(projectID)

    // pretend we're in a PR to test this code path
    process.env.GITHUB_HEAD_REF = 'pr-branch'
    process.env.GITHUB_EVENT_NAME = 'pull_request'

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
      branchID,
      description: `#123 - Test PR`,
      imageUri: 'a.docker/image:tag',
      buildID,
      version: '03403a4f'
    }
    createBuildMock.mockResolvedValueOnce(newBuild)

    const newBatch: Batch = {
      batchID
    }

    const createBatchMock = jest
      .spyOn(BatchesApi.prototype, 'createBatch')
      .mockResolvedValueOnce({ data: newBatch } as AxiosResponse)

    await main.run()

    expect(getProjectIDMock).toHaveBeenCalledTimes(1)
    expect(createBranchMock).not.toHaveBeenCalled()
    expect(createBatchMock).toHaveBeenCalled()
    expect(runMock).toHaveReturned()
    expect(getTokenMock).toHaveBeenCalled()
  })
})
