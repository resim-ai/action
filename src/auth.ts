import * as cache from '@actions/cache'
import * as core from '@actions/core'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

const tokenPath = '.resimtoken'

/**
 * Get auth token from cache or Auth0
 */
export async function getToken(): Promise<string> {
  const apiAudience = 'https://api.resim.ai'
  const clientID = core.getInput('client_id')
  const clientSecret = core.getInput('client_secret')
  const resimUsername = core.getInput('resim_username')
  const resimPassword = core.getInput('resim_password')
  const unpwClientId = core.getInput('password_auth_client_id')
  const auth0TenantUrl: string = core.getInput('auth0_tenant_url')
  const tokenEndpoint = `${auth0TenantUrl}oauth/token`
  const apiEndpoint: string = core.getInput('api_endpoint')

  let token = ''
  let tokenValid = false

  const cacheKey: string | undefined = await cache.restoreCache(
    [tokenPath],
    '',
    ['resim-token-', 'resim-token']
  )

  if (cacheKey) {
    token = await fs.readFile('.resimtoken', 'utf8')

    const options: AxiosRequestConfig = {
      method: 'GET',
      url: `${apiEndpoint}/projects`,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus(status: number) {
        return status >= 200 && status < 500 // default is < 300, but we want to continue if we get a 401
      }
    }
    const response: AxiosResponse = await axios(options)
    if (response.status >= 200 && response.status < 300) {
      core.info('Restored token is valid')
      tokenValid = true
    }
  }

  if (!tokenValid) {
    let config: AxiosRequestConfig

    if (clientID !== '' && clientSecret !== '') {
      config = {
        method: 'POST',
        url: tokenEndpoint,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientID,
          client_secret: clientSecret,
          audience: apiAudience
        })
      }
      const response: AxiosResponse = await axios(config)
      token = response.data.access_token
    } else if (resimUsername !== '' && resimPassword !== '') {
      config = {
        method: 'POST',
        url: tokenEndpoint,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
          realm: 'cli-users',
          client_id: unpwClientId,
          audience: apiAudience,
          username: resimUsername,
          password: resimPassword
        })
      }
      const response: AxiosResponse = await axios(config)
      token = response.data.access_token
    } else {
      core.setFailed(
        'credentials not found - set client ID and secret, or username and password'
      )
      token = 'ERROR'
    }

    if (token !== 'ERROR') {
      await fs.writeFile(tokenPath, token)
      await cache.saveCache([tokenPath], `resim-token-${uuidv4()}`)
    }
  }

  await fs.unlink(tokenPath)

  return token
}
