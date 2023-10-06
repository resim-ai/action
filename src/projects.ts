import { Project, ProjectsApi, ListProjects200Response, Branch } from './client'
import type { AxiosResponse } from 'axios'
import { isAxiosError } from 'axios'

export async function getLatestProject(api: ProjectsApi): Promise<Project> {
  let projectsResponse: AxiosResponse<ListProjects200Response>
  try {
    projectsResponse = await api.listProjects(100, undefined, 'timestamp')
    if (
      projectsResponse.status === 200 &&
      projectsResponse.data.projects?.length &&
      projectsResponse.data.projects.length > 0
    ) {
      const latestProject = projectsResponse.data.projects[0]
      if (!latestProject) {
        throw new Error('Could not find latest project')
      }
      return Promise.resolve(latestProject)
    }
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data.message)
    }
  }

  return Promise.reject(new Error('Could not find latest project'))
}

export async function branchExists(
  api: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<boolean> {
  let branches: Branch[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response = await api.listBranchesForProject(
      projectID,
      100,
      pageToken,
      'timestamp'
    )
    if (response.data.branches) {
      branches.push(...response.data.branches)
    }
    pageToken = response.data.nextPageToken
  }

  const theBranch = branches.find(b => b.name === branchName)

  if (theBranch !== undefined) {
    return Promise.resolve(true)
  } else {
    return Promise.resolve(false)
  }
}

export async function createBranch(
  api: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<string> {
  const newBranchBody: Branch = {
    branchType: 'CHANGE_REQUEST',
    name: branchName
  }

  const newBranchResponse = await api.createBranchForProject(
    projectID,
    newBranchBody
  )
  let newBranchID = ''
  if (newBranchResponse.data.branchID !== undefined) {
    newBranchID = newBranchResponse.data.branchID
  }

  return Promise.resolve(newBranchID)
}
