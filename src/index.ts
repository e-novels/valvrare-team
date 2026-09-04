import { initExtensionApi, logger, settings } from './utilities'
import { activateScraper } from './scraper'
import { activateTheme } from './theme'
import { activateTTS } from './tts'
import { registerTranslatorProfile } from './translator'
import {
  loginAndCheckConnection,
  checkConnectionAction,
  clearSession,
  loadStoredSession
} from './scraper/auth'

export { extractArticleParagraphs } from './scraper/html'
export { fetchBookDetail, resolveNovelId, extractIdFromSlug, cleanNovelSlug } from './scraper/bookDetail'
export { fetchChapter, resolveChapterId, cleanChapterSlug } from './scraper/chapter'
export { executeSearch, getFilterOptions, toBookSummary } from './scraper/search'
export { fetchDownloadContent } from './scraper/download'
export { fetchComments, toScraperComment } from './scraper/comment'
export { fetchReviews, toScraperReview } from './scraper/rating'
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
} from './scraper/auth'
export { valvrareClient, ValvrareClient } from './scraper/client'
export * from './utilities'

declare const __NOVEL_EXTENSION_KIND__: 'scraper' | 'theme' | 'tts' | 'translator'

export async function activate(novel: NovelExtensionApi): Promise<void> {
  initExtensionApi(novel)

  if (__NOVEL_EXTENSION_KIND__ === 'scraper') {
    await activateScraper(novel)
    await loadStoredSession()
    if (novel.settings) {
      await novel.settings.register({
        loginAndCheckConnection,
        checkConnectionAction,
        clearSession
      })
    }
  } else if (__NOVEL_EXTENSION_KIND__ === 'tts') {
    await activateTTS(novel)
  } else if (__NOVEL_EXTENSION_KIND__ === 'translator') {
    registerTranslatorProfile(novel)
  } else {
    await activateTheme(novel)
  }
  await logger.info(`Activated ${novel.extension.id}`)
}

export async function deactivate(): Promise<void> {
  return
}