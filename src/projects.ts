import * as core from '@actions/core'
import { Project, ProjectsApi, ListProjects200Response, Branch } from './client'
import type { AxiosResponse } from 'axios'
import { isAxiosError } from 'axios'
import Debug from 'debug'
const debug = Debug('projects')

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
      return latestProject
    }
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data.message)
    }
  }

  return new Error('Could not find latest project')
}

export async function getBranchID(
  api: ProjectsApi,
  projectID: string,
  branchName: string
): Promise<string> {
  const branches: Branch[] = []

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
  const newBranchBody: Branch = {
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

export async function getProjectID(projectsApi: ProjectsApi): Promise<string> {
  let projectID = ''
  if (core.getInput('project') !== '') {
    projectID = core.getInput('project')
  } else {
    const project = await getLatestProject(projectsApi)
    if (project?.projectID !== undefined) {
      projectID = project.projectID
    }
  }
  if (projectID === '') {
    core.setFailed('Could not find project ID')
  }

  return projectID
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
