import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as auth from '../src/auth'
import axios from 'axios'
import fs from 'fs/promises'

jest.mock('fs/promises')

jest.mock('axios')
const mockedAxios = axios as jest.MockedFunction<typeof axios>

const getInputMock = jest.spyOn(core, 'getInput')
const saveCacheMock = jest.spyOn(cache, 'saveCache')
const restoreCacheMock = jest.spyOn(cache, 'restoreCache')

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
    default:
      return ''
  }
}

describe('auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('restores an invalid token and gets a new one', async () => {
    getInputMock.mockImplementation(defaultInput)

    // Restore a cache
    restoreCacheMock.mockReturnValueOnce(
      Promise.resolve('resim-token-cache-key-1')
    )

    fs.readFile = jest.fn().mockResolvedValueOnce('this-token-was-cached')

    // The token is invalid
    mockedAxios.mockResolvedValueOnce({ data: {}, status: 401 })

    mockedAxios.mockResolvedValueOnce({
      data: { access_token: 'have-a-token' },
      status: 200
    })

    fs.writeFile = jest.fn().mockResolvedValueOnce(undefined)

    saveCacheMock.mockResolvedValueOnce(1234)

    fs.unlink = jest.fn().mockResolvedValueOnce(undefined)

    await auth.getToken()

    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(fs.readFile).toHaveBeenCalledTimes(1)
    expect(mockedAxios).toHaveBeenCalledTimes(2)
    expect(fs.writeFile).toHaveBeenCalledTimes(1)
    expect(fs.unlink).toHaveBeenCalledWith('.resimtoken')
    expect(saveCacheMock).toHaveBeenCalledTimes(1)
  })

  it('restores a valid token', async () => {
    getInputMock.mockImplementation(defaultInput)

    // Restore a cache
    restoreCacheMock.mockReturnValueOnce(
      Promise.resolve('resim-token-cache-key-1')
    )

    fs.readFile = jest.fn().mockResolvedValueOnce('this-token-was-cached')

    // The token is valid
    mockedAxios.mockResolvedValueOnce({ data: {}, status: 200 })

    fs.writeFile = jest.fn().mockResolvedValueOnce(undefined)

    saveCacheMock.mockResolvedValueOnce(1234)

    fs.unlink = jest.fn().mockResolvedValueOnce(undefined)

    await auth.getToken()

    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(fs.readFile).toHaveBeenCalledTimes(1)
    expect(mockedAxios).toHaveBeenCalledTimes(1)
    expect(fs.unlink).toHaveBeenCalledWith('.resimtoken')
    expect(saveCacheMock).toHaveBeenCalledTimes(1)
  })
})
