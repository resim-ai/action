import type { AxiosResponse } from 'axios'
import { ListSystemsOutput, System, SystemsApi } from './client'

export async function listSystems(
  projectID: string,
  systemName: string,
  api: SystemsApi
): Promise<System[]> {
  const systems: System[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListSystemsOutput> = await api.listSystems(
      projectID,
      systemName,
      100,
      pageToken
    )
    if (response.data.systems) {
      systems.push(...response.data.systems)
    }
    pageToken = response.data.nextPageToken
  }

  return systems
}

export async function getSystemID(
  systemsApi: SystemsApi,
  projectID: string,
  systemName: string
): Promise<string> {
  const systems = await listSystems(projectID, systemName, systemsApi)
  const thisSystem = systems.find(s => s.name === systemName)
  if (thisSystem?.systemID !== undefined) {
    return thisSystem.systemID
  }
  throw new Error(`Could not find system ${systemName}`)
}
