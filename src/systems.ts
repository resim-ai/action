import { System, SystemsApi, ListSystemsOutput } from './client'
import type { AxiosResponse } from 'axios'

export async function listSystems(
  projectID: string,
  api: SystemsApi
): Promise<System[]> {
  const systems: System[] = []

  let pageToken: string | undefined = undefined
  while (pageToken !== '') {
    const response: AxiosResponse<ListSystemsOutput> = await api.listSystems(
      projectID,
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

// export async function getSystemID(
//   systemsApi: SystemsApi,
//   projectID: string,
//   systemName: string
// ): Promise<string> {
//   return listSystems(projectID, systemsApi).then(systems => {
//     const thisSystem = systems.find(s => s.name === systemName)
//     if (thisSystem?.systemID !== undefined) {
//       return thisSystem.systemID
//     } else {
//       throw new Error(`Could not find system ${systemName}`)
//     }
//   })
// }

export async function getSystemID(
  systemsApi: SystemsApi,
  projectID: string,
  systemName: string
): Promise<string> {
  const systems = await listSystems(projectID, systemsApi)
  const thisSystem = systems.find(s => s.name === systemName)
  if (thisSystem?.systemID !== undefined) {
    return thisSystem.systemID
  }
  throw new Error(`Could not find system ${systemName}`)
}
