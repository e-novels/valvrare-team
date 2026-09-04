export const BASE_URL = 'https://valvrareteam.net'

import { fetchBookDetail } from './bookDetail'
import { fetchChapter } from './chapter'
import { executeSearch, getFilterOptions } from './search'
import { fetchDownloadContent } from './download'
import { ensureAuthenticatedSession } from './auth'

export { extractArticleParagraphs } from './html'
export { fetchBookDetail, resolveNovelId, extractIdFromSlug } from './bookDetail'
export { fetchChapter, resolveChapterId } from './chapter'
export { executeSearch, getFilterOptions, toBookSummary } from './search'
export { fetchDownloadContent } from './download'
export {
  login,
  checkConnection,
  checkConnectionAction,
  clearSession,
  loadStoredSession,
  ensureAuthenticatedSession,
  getAuthHeaders,
  getCachedToken,
  setCachedToken
} from './auth'
export { valvrareClient, ValvrareClient } from './client'

export async function activateScraper(novel: NovelExtensionApi): Promise<void> {
  await novel.scraper.register({
    async search({ filters, page, pageSize }) {
      await ensureAuthenticatedSession()
      return executeSearch(filters, page, pageSize)
    },
    async getBookDetail({ bookRef }) {
      await ensureAuthenticatedSession()
      return fetchBookDetail(bookRef)
    },
    async getChapter({ chapterRef, bookRef }) {
      await ensureAuthenticatedSession()
      return fetchChapter(chapterRef, bookRef)
    },
    async getFilterOptions(request) {
      await ensureAuthenticatedSession()
      return getFilterOptions(request)
    },
    async download(request) {
      await ensureAuthenticatedSession()
      return fetchDownloadContent(request)
    }
  })
}