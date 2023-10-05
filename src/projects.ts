import { ProjectsApi, ListProjects200Response } from './client'
import type { AxiosResponse } from 'axios'
import { isAxiosError } from 'axios'

export async function getLatestProject(api: ProjectsApi): Promise<string> {
  let projectsResponse: AxiosResponse<ListProjects200Response>
  try {
    projectsResponse = await api.listProjects(1, undefined, 'timestamp')
    if (
      projectsResponse.status === 200 &&
      projectsResponse.data.projects?.length &&
      projectsResponse.data.projects.length > 0
    ) {
      const latestProjectName = projectsResponse.data.projects[0].name
      if (!latestProjectName) {
        throw new Error('Could not find latest project name')
      }
      return Promise.resolve(latestProjectName)
    }
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data.message)
    }
  }

  return Promise.reject(new Error('Could not find latest project name'))
}
