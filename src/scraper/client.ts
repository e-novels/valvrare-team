import { network } from '../utilities'
import { getAuthHeaders } from './auth'

export const BASE_URL = 'https://valvrareteam.net'

export class ValvrareClient {
  private baseUrl: string

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl
  }

  resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl
    }
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
    return `${this.baseUrl}${cleanPath}`
  }

  async fetchJson<T>(pathOrUrl: string, headers: Record<string, string> = {}): Promise<T> {
    const fullUrl = this.resolveUrl(pathOrUrl)
    const authHeaders = getAuthHeaders()
    const mergedHeaders: Record<string, string> = {
      Accept: 'application/json',
      Referer: 'https://valvrareteam.net/',
      Origin: 'https://valvrareteam.net',
      ...authHeaders,
      ...headers
    }

    return network.fetchJson<T>(fullUrl, { headers: mergedHeaders })
  }

  async fetchText(pathOrUrl: string, headers: Record<string, string> = {}): Promise<string> {
    const fullUrl = this.resolveUrl(pathOrUrl)
    const authHeaders = getAuthHeaders()
    const mergedHeaders: Record<string, string> = {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: 'https://valvrareteam.net/',
      Origin: 'https://valvrareteam.net',
      ...authHeaders,
      ...headers
    }

    return network.fetchText(fullUrl, { headers: mergedHeaders })
  }
}

export const valvrareClient = new ValvrareClient()
