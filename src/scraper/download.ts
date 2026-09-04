import { progress } from '../utilities'
import { fetchBookDetail } from './bookDetail'
import { fetchChapter } from './chapter'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchDownloadContent(
  request: ScraperDownloadRequest
): Promise<ScraperBookDetailWithContent> {
  const bookDetail = await fetchBookDetail(String(request.book_id))

  const targetVolumes = request.volume_id
    ? bookDetail.volumes.filter(v => String(v.volume_id) === String(request.volume_id))
    : bookDetail.volumes

  if (targetVolumes.length === 0) {
    throw new Error(`Không tìm thấy tập dữ liệu tương ứng để tải về.`)
  }

  // Count total chapters to download
  let totalChapters = 0
  for (const vol of targetVolumes) {
    totalChapters += vol.chapters.length
  }

  let completedChapters = 0
  const volumesWithContent: ScraperVolumeWithContent[] = []

  for (const vol of targetVolumes) {
    const chaptersWithContent: ScraperChapter[] = []

    for (const chap of vol.chapters) {
      try {
        const fullChapter = await fetchChapter(String(chap.chapter_id), String(bookDetail.book_id))
        chaptersWithContent.push(fullChapter)
      } catch (err) {
        // Fallback with empty paragraph on individual error
        chaptersWithContent.push({
          chapter_id: chap.chapter_id,
          chapter_name: chap.chapter_name,
          chapter_number: chap.chapter_number,
          volume_id: vol.volume_id,
          book_id: bookDetail.book_id,
          content: [`[Lỗi khi tải chương: ${String(err)}]`],
          total_index: 1,
          status: 'ongoing',
          created_at: chap.created_at,
          updated_at: chap.updated_at
        })
      }

      completedChapters++
      const percentage = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 100

      await progress.report({
        message: `Đang tải: ${chap.chapter_name} (${completedChapters}/${totalChapters})`,
        percentage
      })

      // Polite throttling between requests
      await delay(150)
    }

    volumesWithContent.push({
      volume_id: vol.volume_id ?? `${bookDetail.book_id}_vol_${vol.volume_number}`,
      volume_name: vol.volume_name,
      volume_number: vol.volume_number,
      created_at: vol.created_at,
      updated_at: vol.updated_at,
      chapters: chaptersWithContent
    })
  }

  return {
    ...bookDetail,
    book_id: bookDetail.book_id ?? request.book_id,
    volumes: volumesWithContent
  }
}
