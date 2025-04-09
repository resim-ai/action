import type { AxiosResponse } from 'axios'
import * as uuid from 'uuid'
import * as builds from '../src/builds'
import { Build, BuildsApi, Configuration } from '../src/client'

describe('builds', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a build', async () => {
    const config = new Configuration({
      basePath: 'example.com',
      accessToken: 'token'
    })
    const api = new BuildsApi(config)

    const projectID = uuid.v4()
    const systemID = uuid.v4()
    const branchID = uuid.v4()
    const userID = uuid.v4()
    const buildID = uuid.v4()
    const orgID = 'the-org-id'
    const imageUri = 'a.docker/image:tag'
    const version = '0.0.1'
    const associatedAccount = 'github'
    const buildSpecification = 'buildSpecification'
    const creationTimestamp = '2021-01-01T00:00:00.000Z'
    const description = 'some build'
    const longDescription = ''
    const name = 'some build name'

    const newBuildResponse: Build = {
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

    const createBuildApiMock = jest
      .spyOn(BuildsApi.prototype, 'createBuildForBranch')
      .mockResolvedValueOnce({ data: newBuildResponse } as AxiosResponse)

    expect(
      await builds.createBuild(
        api,
        projectID,
        branchID,
        systemID,
        imageUri,
        description,
        version
      )
    ).toBe(newBuildResponse)
    expect(createBuildApiMock).toHaveBeenCalledTimes(1)
  })
})
