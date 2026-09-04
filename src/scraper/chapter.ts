import { logger } from '../utilities'
import { valvrareClient } from './client'
import { extractArticleParagraphs } from './html'
import { extractIdFromSlug } from './bookDetail'

export interface ApiChapterResponse {
  chapter: {
    _id: string
    novelId: string
    moduleId?: string
    title: string
    content: string
    order?: number
    createdAt?: string
    updatedAt?: string
  }
}

export async function resolveChapterId(chapterRef: string): Promise<string> {
  const cleanRef = String(chapterRef).trim().replace(/^\/+/, '')
  const directId = extractIdFromSlug(cleanRef)
  if (directId) return directId

  try {
    const lookupRes = await valvrareClient.fetchJson<{ id: string }>(`/api/chapters/slug/${encodeURIComponent(cleanRef)}`)
    if (lookupRes && lookupRes.id) {
      return lookupRes.id
    }
  } catch (err) {
    await logger.warn(`[Chapter] Failed to lookup chapter ID from slug "${cleanRef}":`, err)
  }

  return cleanRef
}

export async function fetchChapter(chapterRef: string, bookRef?: string): Promise<ScraperChapter> {
  const chapterId = await resolveChapterId(chapterRef)
  const chapterUrl = `/api/chapters/${chapterId}`

  const data = await valvrareClient.fetchJson<ApiChapterResponse>(chapterUrl)
  if (!data || !data.chapter) {
    throw new Error(`Không tìm thấy nội dung chương cho ID "${chapterId}".`)
  }

  const chapter = data.chapter
  const paragraphs = extractArticleParagraphs(chapter.content || '')

  const chapterNumber = (chapter.order ?? 0) + 1

  return {
    chapter_id: chapter._id,
    chapter_name: chapter.title || `Chương ${chapterNumber}`,
    chapter_number: chapterNumber,
    volume_id: chapter.moduleId,
    book_id: chapter.novelId || bookRef,
    content: paragraphs,
    total_index: paragraphs.length,
    status: 'ongoing',
    created_at: chapter.createdAt,
    updated_at: chapter.updatedAt
  }
}
