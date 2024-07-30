// import { error } from 'console'
// import {
//   Configuration,
//   ProjectsApi,
//   ListProjects200Response,
//   BuildsApi
// } from './client'
// import type { AxiosResponse } from 'axios'
// import { isAxiosError } from 'axios'
// // import { branchExists, createBranch, getLatestProject } from './projects'
// import { createBuild } from './builds'
// import Debug from 'debug'
// const debug = Debug('projects')

// async function main() {
//   const config = new Configuration({
//     basePath: process.env.RESIM_API_URL,
//     accessToken: process.env.RESIM_TOKEN
//   })

//   const projectsApi = new ProjectsApi(config)

//   // debug((await getLatestProject(projectsApi)).projectID)
//   //   if (await branchExists(projectsApi, "4e570ad5-d8b6-4a80-979e-7892caea4367", "resim-ai/action/2")) {
//   //     console.log('it exists')
//   //   } else {
//   //     console.log('it doesn\'t')
//   //     debug(await createBranch(projectsApi, "4e570ad5-d8b6-4a80-979e-7892caea4367", "resim-ai/action"))
//   //   }
//   // }

//   // const buildsApi = new BuildsApi(config)

//   // const newBuild = await createBuild()
// }

// main()
