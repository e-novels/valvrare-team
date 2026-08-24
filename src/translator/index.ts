export function registerTranslatorProfile(novel: NovelExtensionApi): void {
  if (!novel.translator) {
    throw new Error('Translator API is not available on novel instance.')
  }

  novel.translator.register({
    getLanguages: () => {
      return {
        sourceLanguages: ['auto', 'en', 'zh', 'ja', 'ko'],
        targetLanguages: ['en', 'vi']
      }
    },
    translate: async (request) => {
      const { paragraphs } = request
      if (!paragraphs || !Array.isArray(paragraphs)) {
        return { translatedParagraphs: [] }
      }

      await novel.logger.info(`Translating ${paragraphs.length} paragraphs...`)

      const provider = (await novel.storage?.get<string>('provider')) || 'mock'
      const apiKey = await novel.storage?.get<string>('apiKey')

      if (provider === 'custom' && apiKey && novel.network) {
        try {
          // Example AI translation HTTP call using novel.network API
          const response = await novel.network.fetchJson<{ translated?: string[] }>('https://api.example.com/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ paragraphs, target: request.targetLang || 'en' }),
            timeout: 120_000 // 2 minutes for batch AI translation
          })
          if (response && Array.isArray(response.translated)) {
            return { translatedParagraphs: response.translated }
          }
        } catch (err) {
          await novel.logger.warn('Custom API translation failed, falling back to batch mock translator:', String(err))
        }
      }

      // Default mock batch translator fallback
      const translatedParagraphs = paragraphs.map((p) => {
        if (!p || !p.trim() || p.startsWith('@{') || p.startsWith('!{')) {
          return p
        }
        return `[AI Translated] ${p}`
      })

      return { translatedParagraphs }
    }
  })
}
