import { Build, BuildsApi } from './client'

export async function createBuild(
  api: BuildsApi,
  projectID: string,
  branchID: string,
  imageUri: string,
  description: string,
  version: string
): Promise<Build> {
  const newBuildBody: Build = {
    projectID,
    imageUri,
    description,
    version
  }

  const newBuildResponse = await api.createBuildForBranch(
    projectID,
    branchID,
    newBuildBody
  )
  const newBuild = newBuildResponse.data ?? {}

  return newBuild
}
