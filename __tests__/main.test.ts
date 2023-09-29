/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */
import * as main from '../src/main'
import * as auth from '../src/auth'
import { BatchesApi } from '../src/client'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the auth functions
const getTokenMock = jest.spyOn(auth, 'getToken')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gets a token from the auth functions', async () => {
    getTokenMock.mockImplementation(async (): Promise<string> => {
      return Promise.resolve('token')
    })

    const createBatchMock = jest
      .spyOn(BatchesApi.prototype, 'createBatch')
      .mockImplementation()

    await main.run()

    expect(createBatchMock).toHaveBeenCalled()
    expect(runMock).toHaveReturned()
    expect(getTokenMock).toHaveBeenCalled()
  })
})
