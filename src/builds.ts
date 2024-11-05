import { debug } from '@actions/core'
import { Build, BuildsApi, CreateBuildForBranchInput } from './client'

export async function createBuild(
  api: BuildsApi,
  projectID: string,
  branchID: string,
  systemID: string,
  imageUri: string,
  description: string,
  version: string
): Promise<Build> {
  const newBuildBody: CreateBuildForBranchInput = {
    systemID,
    imageUri,
    description,
    version
  }
  debug("Creating a new build:\n" + JSON.stringify(newBuildBody))

  const newBuildResponse = await api.createBuildForBranch(
    projectID,
    branchID,
    newBuildBody
  )
  const newBuild = newBuildResponse.data ?? {}

  return newBuild
}
