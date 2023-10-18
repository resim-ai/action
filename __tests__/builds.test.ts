import { Configuration, Build, BuildsApi } from '../src/client'
import * as builds from '../src/builds'
import type { AxiosResponse } from 'axios'
import * as uuid from 'uuid'

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
    const branchID = uuid.v4()
    const imageUri = 'a.docker/image:tag'
    const description = 'some code'
    const version = '0.0.1'

    const newBuildResponse: Build = {
      buildID: uuid.v4(),
      projectID,
      branchID,
      imageUri,
      description,
      version
    }

    const createBuildApiMock = jest
      .spyOn(BuildsApi.prototype, 'createBuildForBranch')
      .mockResolvedValueOnce({ data: newBuildResponse } as AxiosResponse)

    expect(
      await builds.createBuild(
        api,
        projectID,
        branchID,
        imageUri,
        description,
        version
      )
    ).toBe(newBuildResponse)
    expect(createBuildApiMock).toHaveBeenCalledTimes(1)
  })
})
