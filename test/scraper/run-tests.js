'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const runScraperContractTests = require('./contract.test')

function readJsonFixture(root, filename) {
  const fixturePath = path.join(root, 'test', 'scraper', 'fixtures', filename)
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
}

module.exports = async function runScraperTests(root, manifest) {
  const searchFixture = readJsonFixture(root, 'search.json')
  const detail = readJsonFixture(root, 'book-detail.json')
  const chapter = readJsonFixture(root, 'chapter.json')
  const html = fs.readFileSync(path.join(root, 'test', 'scraper', 'fixtures', 'chapter.html'), 'utf8')

  assert.equal(manifest.icon, './public/icon.png')
  assert.ok(manifest.permissions.includes('network'))
  assert.ok(manifest.permissions.includes('reader'))
  assert.ok(manifest.permissions.includes('storage'))
  assert.ok(Array.isArray(manifest.network?.allowedHosts) && manifest.network.allowedHosts.length > 0)
  assert.equal(
    manifest.network.allowedHosts.includes(new URL(manifest.contributes.scraper.site.baseUrl).hostname),
    true
  )
  assert.deepEqual(
    manifest.contributes.scraper.capabilities.slice().sort(),
    ['download', 'getBookDetail', 'getChapter', 'getComments', 'getFilterOptions', 'getReviews', 'search'].sort()
  )

  async function smokeBundle(filename) {
    const entryPath = path.join(root, 'dist', filename)
    assert.ok(fs.existsSync(entryPath), `${filename} must be built before testing`)
    delete require.cache[require.resolve(entryPath)]
    const extension = require(entryPath)
    const logs = []
    const requests = []
    let handlers
    let settingsHandlers

    const storageMap = new Map()

    const mockCommentsData = {
      comments: [
        {
          _id: 'comm_1',
          text: '<p>Great novel!</p>',
          user: {
            _id: 'user_1',
            username: 'TestReader',
            displayName: 'Test Reader',
            avatar: 'https://cdn.valvrareteam.net/avatars/test.jpg'
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          likesCount: 5,
          replies: [
            {
              _id: 'reply_1',
              text: '<p>I agree!</p>',
              user: {
                _id: 'user_2',
                username: 'ReplyReader',
                displayName: 'Reply Reader'
              },
              createdAt: '2026-01-02T00:00:00.000Z',
              likesCount: 1
            }
          ]
        }
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalComments: 1,
        hasNext: false
      }
    }

    const mockReviewsData = {
      reviews: [
        {
          id: 'rev_1',
          user: {
            _id: 'user_1',
            username: 'TestReviewer',
            displayName: 'Test Reviewer',
            avatar: 'https://cdn.valvrareteam.net/avatars/reviewer.jpg'
          },
          rating: 5,
          review: '<p>Outstanding translation and quality.</p>',
          createdAt: '2026-01-01T00:00:00.000Z',
          likesCount: 10,
          isLikedByCurrentUser: false
        }
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1
      }
    }

    const mockNovel = {
      version: '1.0.0',
      extension: { id: manifest.name },
      logger: {
        info: async value => logs.push(value),
        warn: async () => undefined,
        error: async () => undefined
      },
      progress: {
        report: async () => undefined
      },
      network: {
        fetchJson: async (url, options) => {
          requests.push(url)
          const requestUrl = new URL(url)
          const pathname = requestUrl.pathname

          if (pathname === '/api/novels/search') {
            const query = requestUrl.searchParams.get('title')
            if (query === 'rate-limited') {
              throw new Error('Source request failed with HTTP 429.')
            }
            if (query === 'data-image') {
              return [
                {
                  _id: '101',
                  title: 'Data Image Book',
                  illustration: 'data:image/png;base64,aGVsbG8=',
                  status: 'Ongoing'
                }
              ]
            }
            return [
              {
                _id: '101',
                title: 'Example Book',
                author: 'Example Author',
                illustration: 'https://cdn.valvrareteam.net/covers/example-book.jpg',
                status: 'Ongoing'
              }
            ]
          }

          if (pathname === '/api/novels') {
            return searchFixture
          }

          if (pathname === '/api/novels/101/complete') {
            return detail
          }

          if (pathname === '/api/chapters/301') {
            return chapter
          }

          if (pathname === '/api/chapters/invalid') {
            return {
              chapter: {
                _id: 'invalid',
                novelId: '101',
                title: 'Invalid',
                content: '   '
              }
            }
          }

          if (pathname === '/api/novels/slug/dungeon-defense-cd23c90b') {
            return { id: '67ea5aa24accb76ecd23c90b', title: 'Dungeon Defense' }
          }

          if (pathname === '/api/chapters/slug/chuong-2-chua-quy-len-san-dien-4f001ae0') {
            return { id: '67f3acc84febbb854f001ae0', title: 'Chương 2: Chúa quỷ lên sàn diễn' }
          }

          if (pathname === '/api/chapters/67f3acc84febbb854f001ae0') {
            return {
              chapter: {
                _id: '67f3acc84febbb854f001ae0',
                novelId: '67ea5aa24accb76ecd23c90b',
                title: 'Chương 2: Chúa quỷ lên sàn diễn',
                content: '<p>Chapter text</p>'
              }
            }
          }

          if (pathname === '/api/comments') {
            const contentType = requestUrl.searchParams.get('contentType')
            const contentId = requestUrl.searchParams.get('contentId')
            return {
              comments: [
                {
                  _id: 'chap_comm_1',
                  text: '<p>Quả sừng mất tiêu r huhu</p>',
                  user: {
                    _id: 'user_chap',
                    username: 'YH123',
                    displayName: 'YH123',
                    avatar: 'https://cdn.valvrareteam.net/avatars/test.jpg'
                  },
                  contentType: contentType || 'chapters',
                  contentId: contentId || '101-301',
                  createdAt: '2026-04-29T23:27:06.524Z',
                  likesCount: 2,
                  replies: []
                }
              ],
              pagination: {
                currentPage: 1,
                totalPages: 1,
                totalComments: 1,
                hasNext: false
              }
            }
          }

          if (pathname.startsWith('/api/comments/novel/')) {
            return mockCommentsData
          }

          if (pathname.startsWith('/api/usernovelinteractions/reviews/')) {
            return mockReviewsData
          }

          throw new Error(`Unexpected fixture request: ${url}`)
        },
        fetchText: async url => {
          requests.push(url)
          return html
        }
      },
      scraper: {
        register: async registered => {
          handlers = registered
        }
      },
      settings: {
        register: async registered => {
          settingsHandlers = registered
        }
      },
      storage: {
        get: async key => storageMap.get(key) ?? null,
        set: async (key, val) => {
          storageMap.set(key, val)
        },
        remove: async key => {
          storageMap.delete(key)
        },
        createAssetUrl: async path => (path === 'models/voice.onnx' ? 'novel-ext://mock-token/voice.onnx' : null)
      }
    }

    // Mock global fetch for auth tests
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url, opts = {}) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/auth/login')) {
        const body = JSON.parse(opts.body || '{}')
        if (body.username === 'mockUser' && body.password === 'mockPass') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token: 'mock-jwt-token-12345',
              refreshToken: 'mock-refresh-token',
              user: { _id: 'user_1', username: 'mockUser', displayName: 'Mock User' }
            })
          }
        }
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: 'Invalid username or password' })
        }
      }

      if (urlStr.includes('/api/auth/check-session')) {
        const auth = opts.headers?.Authorization || opts.headers?.authorization
        if (auth === 'Bearer mock-jwt-token-12345') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              user: { id: 'user_1', username: 'mockUser', displayName: 'Mock User' }
            })
          }
        }
        return {
          ok: false,
          status: 401,
          json: async () => ({ valid: false })
        }
      }

      return originalFetch(url, opts)
    }

    try {
      await extension.activate(mockNovel)

      assert.deepEqual(logs, [`Activated ${manifest.name}`])
      assert.deepEqual(
        extension.extractArticleParagraphs(html, '.chapter-content'),
        ['First HTML fixture paragraph.', 'Second HTML fixture paragraph.']
      )

      assert.deepEqual(
        Object.keys(handlers).sort(),
        manifest.contributes.scraper.capabilities.slice().sort()
      )

      // 1. Search tests
      const searchWithQuery = await handlers.search({ filters: { query: 'fixture' }, page: 1, pageSize: 20 })
      assert.equal(searchWithQuery.items[0].book_id, '101')
      assert.equal(new URL(requests[0]).searchParams.get('title'), 'fixture')

      const dataImageResult = await handlers.search({ filters: { query: 'data-image' }, page: 1, pageSize: 20 })
      assert.equal(dataImageResult.items[0].book_image, 'data:image/png;base64,aGVsbG8=')

      const searchBrowse = await handlers.search({ filters: {}, page: 2, pageSize: 20 })
      assert.equal(searchBrowse.items[0].book_id, '67f66b09121cfba2bc525712')
      assert.equal(searchBrowse.pagination.page, 2)

      // 2. Book Detail test
      const bookDetail = await handlers.getBookDetail({ bookRef: '101' })
      assert.equal(bookDetail.book_id, '101')
      assert.equal(bookDetail.volumes[0].volume_number, 1)
      assert.equal(bookDetail.volumes[0].chapters[0].chapter_id, '301')
      assert.equal(bookDetail.volumes[0].chapters[0].chapter_number, 1)

      // 3. Chapter test
      const chapterRes = await handlers.getChapter({ chapterRef: '301', bookRef: '101' })
      assert.equal(chapterRes.chapter_id, '301')
      assert.equal(chapterRes.content.length, 2)

      // 4. Filter Options test
      const filterRes = await handlers.getFilterOptions({ fieldId: 'status', filters: {} })
      assert.ok(Array.isArray(filterRes.options) && filterRes.options.length > 0)
      assert.equal(filterRes.options[0].value, 'any')

      // 5. Download test
      const downloadRes = await handlers.download({ book_id: '101' })
      assert.equal(downloadRes.book_id, '101')
      assert.equal(downloadRes.volumes[0].chapters[0].content.length, 2)

      // 6. Comments test
      const commentsRes = await handlers.getComments({ bookRef: '101' })
      assert.equal(commentsRes.data.length, 1)
      assert.equal(commentsRes.data[0].socket_id, 'comm_1')
      assert.equal(commentsRes.data[0].content, 'Great novel!')
      assert.equal(commentsRes.data[0].replies.length, 1)
      assert.equal(commentsRes.data[0].replies[0].content, 'I agree!')

      // Comments replies via parentRef
      const repliesRes = await handlers.getComments({ bookRef: '101', parentRef: 'comm_1' })
      assert.equal(repliesRes.data.length, 1)
      assert.equal(repliesRes.data[0].socket_id, 'reply_1')

      // Chapter comments test: direct bookRef + targetRef
      const chapCommentsRes = await handlers.getComments({ bookRef: '101', commentTarget: 'chapter', targetRef: '301' })
      assert.equal(chapCommentsRes.data.length, 1)
      assert.equal(chapCommentsRes.data[0].socket_id, 'chap_comm_1')
      assert.equal(chapCommentsRes.data[0].chapter_id, '301')

      // Chapter comments test: full chapter URL (sample URL provided by user)
      const sampleChapterUrl = 'https://valvrareteam.net/truyen/dungeon-defense-cd23c90b/chuong/chuong-2-chua-quy-len-san-dien-4f001ae0'
      const sampleUrlRes = await handlers.getComments({ bookRef: sampleChapterUrl })
      assert.equal(sampleUrlRes.data.length, 1)
      assert.equal(sampleUrlRes.data[0].socket_id, 'chap_comm_1')
      assert.equal(sampleUrlRes.data[0].content, 'Quả sừng mất tiêu r huhu')
      assert.equal(sampleUrlRes.data[0].chapter_id, '67f3acc84febbb854f001ae0')
      assert.equal(sampleUrlRes.data[0].chapter_name, 'Chương 2: Chúa quỷ lên sàn diễn')

      // Scope filter: series comments should include hideChapterComments=true
      await handlers.getComments({ bookRef: '101', commentScope: 'series' })
      const lastCommentsUrl = requests[requests.length - 1]
      assert.match(lastCommentsUrl, /hideChapterComments=true/)

      // 7. Reviews test
      const reviewsRes = await handlers.getReviews({ bookRef: '101' })
      assert.equal(reviewsRes.length, 1)
      assert.equal(reviewsRes[0].interaction_id, 'rev_1')
      assert.equal(reviewsRes[0].value, 5)
      assert.equal(reviewsRes[0].message, 'Outstanding translation and quality.')

      // 8. Auth flow tests
      assert.equal(extension.getCachedToken(), null)
      const loginFail = await extension.login('badUser', 'badPass')
      assert.equal(loginFail, false)

      const loginSuccess = await extension.login('mockUser', 'mockPass')
      assert.equal(loginSuccess, true)
      assert.equal(extension.getCachedToken(), 'mock-jwt-token-12345')
      assert.equal(await mockNovel.storage.get('valvrare_token'), 'mock-jwt-token-12345')

      const checkRes = await extension.checkConnection()
      assert.equal(checkRes.isLoggedIn, true)
      assert.equal(checkRes.user.username, 'mockUser')

      const checkActionRes = await extension.checkConnectionAction()
      assert.equal(checkActionRes.success, true)
      assert.match(checkActionRes.message, /Mock User/)

      const authHeaders = extension.getAuthHeaders()
      assert.equal(authHeaders.Authorization, 'Bearer mock-jwt-token-12345')

      const clearRes = await extension.clearSession()
      assert.equal(clearRes.success, true)
      assert.equal(extension.getCachedToken(), null)
      assert.equal(await mockNovel.storage.get('valvrare_token'), null)

      // 9. Error handling tests
      await assert.rejects(
        () => handlers.getChapter({ chapterRef: 'invalid' }),
        /The chapter content did not contain readable text/
      )
      await assert.rejects(
        () => handlers.search({ filters: { query: 'rate-limited' }, page: 1, pageSize: 20 }),
        /HTTP 429/
      )

      // 10. Contract enforcement tests
      await runScraperContractTests(root, manifest, handlers)
      await extension.deactivate()
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  try {
    await Promise.all([smokeBundle('index.js'), smokeBundle('browser.js')])
    console.log(`[${manifest.displayName}] Scraper profile tests passed`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}