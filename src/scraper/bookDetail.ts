import { logger } from '../utilities'
import { valvrareClient } from './client'

export interface ApiChapterMeta {
  _id: string
  title: string
  order?: number
  createdAt?: string
  updatedAt?: string
  mode?: string
  moduleId?: string
}

export interface ApiModule {
  _id: string
  title: string
  order?: number
  illustration?: string
  chapters?: ApiChapterMeta[]
}

export interface ApiNovelDetail {
  _id: string
  title: string
  description?: string
  alternativeTitles?: string[]
  genres?: string[]
  author?: string
  illustrator?: string
  illustration?: string
  status?: string
  mode?: string
  views?: {
    total?: number
  }
  createdAt?: string
  updatedAt?: string
}

export interface ApiNovelCompleteResponse {
  novel: ApiNovelDetail
  modules?: ApiModule[]
}

export function extractIdFromSlug(slug: string): string | null {
  if (!slug) return null
  const clean = slug.replace(/^\/+/, '').replace(/^truyen\//, '')
  if (/^[0-9a-fA-F]{24}$/.test(clean)) return clean
  const parts = clean.split('-')
  const last = parts[parts.length - 1]
  if (/^[0-9a-fA-F]{24}$/.test(last)) return last
  return null
}

export function mapNovelStatus(status?: string): string {
  if (!status) return 'ongoing'
  const lower = status.toLowerCase()
  if (lower.includes('complete') || lower.includes('hoàn thành')) return 'completed'
  if (lower.includes('hiatus') || lower.includes('ngưng') || lower.includes('hoãn')) return 'hidden'
  return 'ongoing'
}

export async function resolveNovelId(bookRef: string): Promise<string> {
  const cleanRef = String(bookRef).trim().replace(/^\/+/, '').replace(/^truyen\//, '')
  const directId = extractIdFromSlug(cleanRef)
  if (directId) return directId

  // If slug doesn't contain a full 24-hex ID, call lookupNovelId endpoint
  try {
    const lookupRes = await valvrareClient.fetchJson<{ id: string }>(`/api/novels/slug/${encodeURIComponent(cleanRef)}`)
    if (lookupRes && lookupRes.id) {
      return lookupRes.id
    }
  } catch (err) {
    await logger.warn(`[BookDetail] Failed to lookup novel ID from slug "${cleanRef}":`, err)
  }

  return cleanRef
}

export async function fetchBookDetail(bookRef: string): Promise<ScraperBookDetail> {
  const novelId = await resolveNovelId(bookRef)
  const completeUrl = `/api/novels/${novelId}/complete?skipViewTracking=true`

  const data = await valvrareClient.fetchJson<ApiNovelCompleteResponse>(completeUrl)
  if (!data || !data.novel) {
    throw new Error(`Không tìm thấy dữ liệu truyện cho ID "${novelId}".`)
  }

  const novel = data.novel
  const rawModules = Array.isArray(data.modules) ? data.modules : []

  // Sort modules by order
  const sortedModules = [...rawModules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const volumes: ScraperBookDetail['volumes'] = []

  sortedModules.forEach((mod, modIdx) => {
    const volumeNumber = modIdx + 1
    const rawChapters = Array.isArray(mod.chapters) ? mod.chapters : []
    const sortedChapters = [...rawChapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const chapters = sortedChapters.map((chap, chapIdx) => {
      const chapterNumber = chapIdx + 1
      return {
        chapter_id: chap._id,
        chapter_name: chap.title || `Chương ${chapterNumber}`,
        chapter_number: chapterNumber,
        created_at: chap.createdAt,
        updated_at: chap.updatedAt
      }
    })

    const firstCreatedAt = chapters[0]?.created_at || novel.createdAt
    const lastUpdatedAt = chapters[chapters.length - 1]?.updated_at || novel.updatedAt

    volumes.push({
      volume_id: mod._id,
      volume_name: mod.title || `Tập ${volumeNumber}`,
      volume_number: volumeNumber,
      created_at: firstCreatedAt,
      updated_at: lastUpdatedAt,
      chapters
    })
  })

  // Fallback if no modules/volumes
  if (volumes.length === 0) {
    volumes.push({
      volume_id: `${novel._id}_vol1`,
      volume_name: 'Tập 1',
      volume_number: 1,
      created_at: novel.createdAt,
      updated_at: novel.updatedAt,
      chapters: []
    })
  }

  const authors = novel.author ? [{ author_name: novel.author.trim() }] : []
  const artists = novel.illustrator ? [{ artist_name: novel.illustrator.trim() }] : []
  const genres = (novel.genres || []).map(g => ({ category_name: g.trim() }))

  return {
    book_id: novel._id,
    book_name: novel.title,
    book_image: novel.illustration || '',
    authors,
    artists,
    book_sub_name: novel.alternativeTitles || [],
    status: mapNovelStatus(novel.status),
    description: novel.description || '',
    book_genre: genres,
    volumes,
    views: novel.views?.total || 0,
    follow: 0,
    rating_count: 0,
    total_index: 0,
    total_comment: 0,
    average_rating: 0
  }
}
