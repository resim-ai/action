import { debug } from '@actions/core'
import type { AxiosResponse } from 'axios'
import { isAxiosError } from 'axios'
import {
  Branch,
  CreateBranchInput,
  ListBranchesOutput,
  ListProjectsOutput,
  Project,
  ProjectsApi
} from './client'

export async function getLatestProject(api: ProjectsApi): Promise<Project> {
  let projectsResponse: AxiosResponse<ListProjectsOutput>
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
      return latestProject
    }
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data.message)
    }
  }
  throw new Error('Could not find latest project')
}

export async function listProjects(api: ProjectsApi): Promise<Project[]> {
  const projects: Project[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListProjectsOutput> = await api.listProjects(
      100,
      pageToken,
      'timestamp'
    )
    if (response.data.projects) {
      projects.push(...response.data.projects)
    }
    pageToken = response.data.nextPageToken
  }

  return projects
}

export async function getBranchID(
  api: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<string> {
  const branches: Branch[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListBranchesOutput> =
      await api.listBranchesForProject(
        projectID,
        undefined,
        undefined,
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

  if (theBranch?.branchID !== undefined) {
    return theBranch.branchID
  } else {
    return ''
  }
}

export async function createBranch(
  api: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<string> {
  const newBranchBody: CreateBranchInput = {
    branchType: 'CHANGE_REQUEST',
    name: branchName
  }

  const newBranchResponse = await api.createBranchForProject(
    projectID,
    newBranchBody
  )
  const newBranchID = newBranchResponse.data.branchID ?? ''

  return newBranchID
}

export async function getProjectID(
  projectsApi: ProjectsApi,
  projectName: string
): Promise<string> {
  const projects = await listProjects(projectsApi)
  const thisProject = projects.find(p => p.name === projectName)
  if (thisProject?.projectID !== undefined) {
    return thisProject.projectID
  }
  return Promise.reject(Error(`Could not find project ${projectName}`))
}

export async function findOrCreateBranch(
  projectsApi: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<string> {
  let branchID = await getBranchID(projectsApi, projectID, branchName)
  if (branchID === '') {
    branchID = await createBranch(projectsApi, projectID, branchName)
    debug('created branch')
  } else {
    debug(`branch exists, ${branchID}`)
  }

  return branchID
}
