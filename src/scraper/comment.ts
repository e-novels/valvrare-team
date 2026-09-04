import { parseHTML } from 'linkedom'
import { logger } from '../utilities'
import { valvrareClient } from './client'
import { resolveNovelId, cleanNovelSlug } from './bookDetail'
import { resolveChapterId, cleanChapterSlug, ApiChapterResponse } from './chapter'

export interface ApiCommentUser {
  _id?: string
  username?: string
  displayName?: string
  avatar?: string
  userNumber?: number
}

export interface ApiCommentReply {
  _id: string
  text?: string
  user?: ApiCommentUser
  createdAt?: string
  likesCount?: number
}

export interface ApiCommentItem {
  _id: string
  text?: string
  user?: ApiCommentUser
  contentType?: string
  contentId?: string
  parentId?: string | null
  createdAt?: string
  likesCount?: number
  chapterInfo?: {
    _id?: string
    title?: string
    order?: number
  }
  replies?: ApiCommentReply[]
}

export interface ApiCommentsResponse {
  comments?: ApiCommentItem[]
  pagination?: {
    currentPage?: number
    totalPages?: number
    totalComments?: number
    totalItems?: number
    hasNext?: boolean
    hasPrev?: boolean
    limit?: number
  }
}

function stripHtmlText(html: string = ''): string {
  if (!html) return ''
  const formatted = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
  const { document } = parseHTML(`<div id="__root">${formatted}</div>`)
  const root = document.getElementById('__root') || document.querySelector('div')
  return (root?.textContent || '').trim()
}

export function toScraperComment(item: ApiCommentItem, chapterTitle?: string): ScraperComment {
  const userName = item.user?.displayName || item.user?.username || 'Vô danh'
  const content = stripHtmlText(item.text || '')

  let chapterId: string | undefined
  let chapterName: string | undefined

  if (item.chapterInfo) {
    if (item.chapterInfo._id) chapterId = item.chapterInfo._id
    if (item.chapterInfo.title) chapterName = item.chapterInfo.title
  } else if (item.contentType === 'chapters' && item.contentId) {
    const parts = item.contentId.split('-')
    if (parts.length >= 2) {
      chapterId = parts[1]
    } else {
      chapterId = item.contentId
    }
    if (chapterTitle) {
      chapterName = chapterTitle
    }
  }

  const replies: ScraperComment[] = (item.replies || []).map(reply => ({
    socket_id: reply._id,
    user_id: reply.user?._id,
    user_name: reply.user?.displayName || reply.user?.username || 'Vô danh',
    avatar: reply.user?.avatar || '',
    content: stripHtmlText(reply.text || ''),
    created_at: reply.createdAt,
    total_like: reply.likesCount || 0,
    total_reply: 0,
    is_like: false,
    ...(chapterId !== undefined ? { chapter_id: chapterId } : {}),
    ...(chapterName ? { chapter_name: chapterName } : {})
  }))

  return {
    socket_id: item._id,
    user_id: item.user?._id,
    user_name: userName,
    avatar: item.user?.avatar || '',
    content,
    created_at: item.createdAt,
    total_like: item.likesCount || 0,
    total_reply: replies.length,
    is_like: false,
    replies,
    ...(chapterId !== undefined ? { chapter_id: chapterId } : {}),
    ...(chapterName ? { chapter_name: chapterName } : {})
  }
}

export async function fetchComments(
  request: ScraperBookDetailRequest
): Promise<ScraperCommentsPage> {
  const page = request.page ?? 1
  const pageSize = 10

  try {
    let endpointUrl = ''
    let chapterTitle = ''

    const hasChapterPath = Boolean(
      (request.bookRef && request.bookRef.includes('/chuong/')) ||
      (request.targetRef && request.targetRef.includes('/chuong/'))
    )
    const isChapterTarget = request.commentTarget === 'chapter' || Boolean(request.targetRef) || hasChapterPath

    if (isChapterTarget) {
      const rawChapterRef = request.targetRef || (request.bookRef && request.bookRef.includes('/chuong/') ? request.bookRef : '')
      const chapterId = await resolveChapterId(rawChapterRef)

      // Resolve novelId
      let novelId = ''
      const rawNovelRef = request.bookRef && !request.bookRef.includes('/chuong/')
        ? request.bookRef
        : (request.bookRef || request.targetRef || '')
      const novelSlug = cleanNovelSlug(rawNovelRef)

      if (novelSlug && novelSlug !== chapterId) {
        try {
          novelId = await resolveNovelId(novelSlug)
        } catch {}
      }

      // If novelId is not resolved, or novelId === chapterId, or we want chapter title
      if (!novelId || novelId === chapterId || !chapterTitle) {
        try {
          const chapData = await valvrareClient.fetchJson<ApiChapterResponse>(`/api/chapters/${chapterId}`)
          if (chapData?.chapter) {
            if (!novelId || novelId === chapterId) {
              novelId = chapData.chapter.novelId || novelId
            }
            if (chapData.chapter.title) {
              chapterTitle = chapData.chapter.title
            }
          }
        } catch (err) {
          await logger.warn(`[Comments] Failed to fetch chapter metadata for "${chapterId}":`, err)
        }
      }

      const contentId = novelId && novelId !== chapterId ? `${novelId}-${chapterId}` : chapterId
      endpointUrl = `/api/comments?contentType=chapters&contentId=${encodeURIComponent(contentId)}&page=${page}&limit=${pageSize}&sort=newest`
    } else {
      const novelId = await resolveNovelId(request.bookRef)
      const hideChapterComments = request.commentScope === 'series'
      endpointUrl = `/api/comments/novel/${encodeURIComponent(novelId)}?page=${page}&limit=${pageSize}&hideChapterComments=${hideChapterComments}`
    }

    const response = await valvrareClient.fetchJson<ApiCommentsResponse>(endpointUrl)
    const rawComments = Array.isArray(response.comments) ? response.comments : []

    // If parentRef is requested (reply thread)
    if (request.parentRef) {
      const parent = rawComments.find(c => String(c._id) === String(request.parentRef))
      const replyComments: ScraperComment[] = (parent?.replies || []).map(r => ({
        socket_id: r._id,
        user_id: r.user?._id,
        user_name: r.user?.displayName || r.user?.username || 'Vô danh',
        avatar: r.user?.avatar || '',
        content: stripHtmlText(r.text || ''),
        created_at: r.createdAt,
        total_like: r.likesCount || 0,
        total_reply: 0,
        is_like: false
      }))

      return {
        data: replyComments,
        pagination: {
          page,
          pageSize,
          totalItems: replyComments.length,
          totalPages: 1,
          hasNextPage: false
        }
      }
    }

    const comments = rawComments.map(c => toScraperComment(c, chapterTitle))
    const pagination = response.pagination || {}
    const totalItems = pagination.totalComments ?? pagination.totalItems ?? comments.length
    const totalPages = pagination.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize))
    const hasNextPage = pagination.hasNext ?? page < totalPages

    return {
      data: comments,
      pagination: {
        page: pagination.currentPage ?? page,
        pageSize: pagination.limit ?? pageSize,
        totalItems,
        totalPages,
        hasNextPage
      }
    }
  } catch (err) {
    await logger.warn(`[Comments] Failed to fetch comments for bookRef "${request.bookRef}":`, err)
    return {
      data: [],
      pagination: {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false
      }
    }
  }
}
