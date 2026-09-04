import { parseHTML } from 'linkedom'
import { logger } from '../utilities'
import { valvrareClient } from './client'
import { resolveNovelId } from './bookDetail'

export interface ApiReviewItem {
  id: string
  user?: {
    _id?: string
    username?: string
    displayName?: string
    avatar?: string
  }
  rating?: number
  review?: string
  date?: string
  createdAt?: string
  updatedAt?: string
  likesCount?: number
  isLikedByCurrentUser?: boolean
}

export interface ApiReviewsResponse {
  reviews?: ApiReviewItem[]
  pagination?: {
    currentPage?: number
    totalPages?: number
    totalItems?: number
  }
}

function stripHtmlText(html: string = ''): string {
  if (!html) return ''
  const { document } = parseHTML(`<div id="__root">${html}</div>`)
  const root = document.getElementById('__root') || document.querySelector('div')
  return (root?.textContent || '').trim()
}

export function toScraperReview(item: ApiReviewItem): ScraperReview {
  const userName = item.user?.displayName || item.user?.username || 'Ẩn danh'
  const message = stripHtmlText(item.review || '')
  const ratingValue = typeof item.rating === 'number' ? Math.max(1, Math.min(5, item.rating)) : 5

  return {
    interaction_id: item.id,
    user_id: item.user?._id,
    user_name: userName,
    avatar: item.user?.avatar || '',
    value: ratingValue,
    message,
    created_at: item.createdAt || item.date
  }
}

export async function fetchReviews(bookRef: string): Promise<ScraperReview[]> {
  try {
    const novelId = await resolveNovelId(bookRef)
    const reviewsUrl = `/api/usernovelinteractions/reviews/${encodeURIComponent(novelId)}?page=1&limit=20`

    const response = await valvrareClient.fetchJson<ApiReviewsResponse>(reviewsUrl)
    const rawReviews = Array.isArray(response.reviews) ? response.reviews : []

    return rawReviews.map(toScraperReview)
  } catch (err) {
    await logger.warn(`[Reviews] Failed to fetch reviews for bookRef "${bookRef}":`, err)
    return []
  }
}
