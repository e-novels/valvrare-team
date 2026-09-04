import { parseHTML } from 'linkedom'

function normalizeParagraph(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeImageUrl(src: string): string {
  if (!src) return ''
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `https://valvrareteam.net${src}`
  return src
}

export function extractArticleParagraphs(html: string, contentSelector?: string): string[] {
  if (!html || !html.trim()) {
    throw new Error('The chapter content did not contain readable text.')
  }

  // Wrap fragment in container if needed
  const wrappedHtml = html.includes('<html') || html.includes('<body')
    ? html
    : `<div class="article-body">${html}</div>`

  const { document } = parseHTML(wrappedHtml)
  const container = contentSelector
    ? document.querySelector(contentSelector)
    : (document.querySelector('.article-body') || document.body)

  if (!container) {
    throw new Error(`Could not find chapter content with selector "${contentSelector}".`)
  }

  // Remove script and style tags
  const junkEls = container.querySelectorAll('script, style, noscript')
  junkEls.forEach(el => el.remove())

  const result: string[] = []

  // Check top-level child elements or p elements
  const pEls = container.querySelectorAll('p')
  if (pEls.length > 0) {
    pEls.forEach(p => {
      // Check for image inside paragraph
      const img = p.querySelector('img')
      if (img) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
        if (src) {
          result.push(`@{${normalizeImageUrl(src)}}`)
        }
      }

      // Check text content (ignoring img)
      const text = normalizeParagraph(p.textContent)
      if (text) {
        result.push(text)
      }
    })
  }

  // If no paragraphs were found, or standalone images exist outside paragraphs
  if (result.length === 0) {
    const allImages = container.querySelectorAll('img')
    allImages.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
      if (src) {
        result.push(`@{${normalizeImageUrl(src)}}`)
      }
    })

    for (const lineBreak of container.querySelectorAll('br')) {
      lineBreak.replaceWith(document.createTextNode('\n'))
    }

    const fallback = (container.textContent ?? '')
      .split(/\r?\n/)
      .map(normalizeParagraph)
      .filter(Boolean)

    result.push(...fallback)
  }

  if (result.length === 0) {
    throw new Error('The chapter content did not contain readable text.')
  }

  return result
}