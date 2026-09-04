import { valvrareClient } from './client'

export interface ApiNovelSummary {
  _id: string
  title: string
  author?: string
  illustration?: string
  status?: string
  mode?: string
  description?: string
  genres?: string[]
  totalChapters?: number
  chapterCount?: number
}

export interface ApiNovelsResponse {
  novels?: ApiNovelSummary[]
  items?: ApiNovelSummary[]
  pagination?: {
    currentPage?: number
    totalPages?: number
    totalItems?: number
  }
}

export function toBookSummary(novel: ApiNovelSummary): ScraperBookSummary {
  return {
    book_id: novel._id,
    book_name: novel.title,
    book_image: novel.illustration || '',
    authors: novel.author ? [{ author_name: novel.author.trim() }] : []
  }
}

export async function executeSearch(
  filters: Record<string, ScraperFilterValue> = {},
  page: number = 1,
  pageSize: number = 20
): Promise<ScraperSearchResponse> {
  const query = typeof filters.query === 'string' ? filters.query.trim() : ''
  const statusFilter = typeof filters.status === 'string' && filters.status !== 'any' ? filters.status.trim() : null

  // If search query is provided, call /api/novels/search
  if (query) {
    const searchUrl = `/api/novels/search?title=${encodeURIComponent(query)}`
    const searchResults = await valvrareClient.fetchJson<ApiNovelSummary[]>(searchUrl)
    let list = Array.isArray(searchResults) ? searchResults : []

    if (statusFilter) {
      const lower = statusFilter.toLowerCase()
      list = list.filter(item => (item.status || '').toLowerCase() === lower)
    }

    const totalItems = list.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const startIndex = (page - 1) * pageSize
    const pagedList = list.slice(startIndex, startIndex + pageSize)

    return {
      items: pagedList.map(toBookSummary),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages
      }
    }
  }

  // Otherwise, browse novel list via /api/novels
  const listUrl = `/api/novels?page=${page}&limit=${pageSize}`
  const response = await valvrareClient.fetchJson<ApiNovelsResponse>(listUrl)

  const novels = response.novels || response.items || []
  let filteredNovels = novels

  if (statusFilter) {
    const lower = statusFilter.toLowerCase()
    filteredNovels = novels.filter(item => (item.status || '').toLowerCase() === lower)
  }

  const pagination = response.pagination || {}
  const totalPages = pagination.totalPages ?? 1
  const totalItems = pagination.totalItems ?? filteredNovels.length

  return {
    items: filteredNovels.map(toBookSummary),
    pagination: {
      page: pagination.currentPage ?? page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: (pagination.currentPage ?? page) < totalPages
    }
  }
}

export async function getFilterOptions(
  request: ScraperFilterOptionsRequest
): Promise<ScraperFilterOptionsResponse> {
  if (request.fieldId === 'status') {
    return {
      options: [
        { label: 'Tất cả', value: 'any' },
        { label: 'Đang tiến hành', value: 'Ongoing' },
        { label: 'Hoàn thành', value: 'Completed' },
        { label: 'Tạm ngưng', value: 'Hiatus' }
      ]
    }
  }

  return { options: [] }
}
