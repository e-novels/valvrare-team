import { logger, storage } from '../utilities'

export const STORAGE_TOKEN_KEY = 'valvrare_token'
export const STORAGE_REFRESH_TOKEN_KEY = 'valvrare_refresh_token'
export const STORAGE_USER_PROFILE_KEY = 'valvrare_user_profile'

export interface ValvrareUserProfile {
  id?: string
  _id?: string
  username?: string
  displayName?: string
  userNumber?: number
  role?: string
  avatar?: string
}

export interface ConnectionState {
  isLoggedIn: boolean
  user?: ValvrareUserProfile
  message?: string
}

let cachedToken: string | null = null

export function getCachedToken(): string | null {
  return cachedToken
}

export function setCachedToken(token: string | null): void {
  cachedToken = token
}

export function getAuthHeaders(): Record<string, string> {
  const token = getCachedToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

export async function loadStoredSession(): Promise<string | null> {
  try {
    const token = await storage.get<string>(STORAGE_TOKEN_KEY)
    if (typeof token === 'string' && token.trim()) {
      setCachedToken(token.trim())
      return token.trim()
    }
  } catch (err) {
    await logger.warn('[Auth] Failed to load stored token:', err)
  }
  return null
}

export async function saveSessionToken(token: string, refreshToken?: string, user?: ValvrareUserProfile): Promise<void> {
  try {
    setCachedToken(token)
    await storage.set(STORAGE_TOKEN_KEY, token)
    if (refreshToken) {
      await storage.set(STORAGE_REFRESH_TOKEN_KEY, refreshToken)
    }
    if (user) {
      await storage.set(STORAGE_USER_PROFILE_KEY, user)
    }
  } catch (err) {
    await logger.warn('[Auth] Failed to save session token:', err)
  }
}

export async function clearSession(): Promise<ExtensionSettingsActionResult> {
  try {
    setCachedToken(null)
    await storage.remove(STORAGE_TOKEN_KEY)
    await storage.remove(STORAGE_REFRESH_TOKEN_KEY)
    await storage.remove(STORAGE_USER_PROFILE_KEY)
    return {
      success: true,
      message: 'Đã đăng xuất và xóa phiên đăng nhập Valvrare Team.'
    }
  } catch (err) {
    await logger.warn('[Auth] Failed to clear session:', err)
    return {
      success: false,
      message: 'Lỗi khi xóa phiên đăng nhập: ' + String(err)
    }
  }
}

export async function checkConnection(): Promise<ConnectionState> {
  try {
    const token = getCachedToken() || (await loadStoredSession())
    if (!token) {
      return { isLoggedIn: false, message: 'Chưa đăng nhập.' }
    }

    const res = await fetch('https://valvrareteam.net/api/auth/check-session', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!res.ok) {
      if (res.status === 401) {
        await clearSession()
        return { isLoggedIn: false, message: 'Phiên đăng nhập đã hết hạn.' }
      }
      return { isLoggedIn: false, message: `Lỗi kiểm tra phiên (${res.status}).` }
    }

    const data = await res.json()
    if (data && data.valid === true) {
      const user = data.user as ValvrareUserProfile
      if (user) {
        await storage.set(STORAGE_USER_PROFILE_KEY, user)
      }
      return {
        isLoggedIn: true,
        user,
        message: 'Phiên đăng nhập hợp lệ.'
      }
    }

    return { isLoggedIn: false, message: 'Phiên đăng nhập không hợp lệ.' }
  } catch (err) {
    await logger.warn('[Auth] checkConnection failed:', err)
    return { isLoggedIn: false, message: String(err) }
  }
}

export async function checkConnectionAction(): Promise<ExtensionSettingsActionResult> {
  try {
    const state = await checkConnection()
    if (state.isLoggedIn) {
      const username = state.user?.displayName || state.user?.username || 'Thành viên'
      const userNumber = state.user?.userNumber ? ` (ID: ${state.user.userNumber})` : ''
      return {
        success: true,
        message: `Đã đăng nhập thành công! Tài khoản: ${username}${userNumber}`
      }
    } else {
      return {
        success: false,
        message: state.message || 'Chưa đăng nhập Valvrare Team hoặc phiên đã hết hạn.'
      }
    }
  } catch (err) {
    await logger.warn('[Auth] checkConnectionAction error:', err)
    return {
      success: false,
      message: `Lỗi kiểm tra đăng nhập: ${String(err)}`
    }
  }
}

export async function login(username?: string, password?: string): Promise<boolean> {
  if (!username || !password) {
    await logger.warn('[Auth] Missing username or password for login')
    return false
  }

  try {
    const res = await fetch('https://valvrareteam.net/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim()
      })
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      await logger.warn('[Auth] Login response failed:', res.status, errorData)
      return false
    }

    const data = await res.json()
    if (data && data.token) {
      await saveSessionToken(data.token, data.refreshToken, data.user)
      return true
    }

    return false
  } catch (err) {
    await logger.warn('[Auth] Login request error:', err)
    return false
  }
}

export async function loginAndCheckConnection(
  values: Record<string, unknown> = {}
): Promise<ExtensionSettingsActionResult> {
  let username = typeof values.username === 'string' ? values.username.trim() : ''
  if (!username && typeof values.name === 'string') username = values.name.trim()
  if (!username && typeof values.email === 'string') username = values.email.trim()

  const password = typeof values.password === 'string' ? values.password.trim() : ''

  if (!username || !password) {
    return {
      success: false,
      message: 'Vui lòng nhập đầy đủ Tài khoản và Mật khẩu.'
    }
  }

  try {
    const success = await login(username, password)
    if (success) {
      const state = await checkConnection()
      const displayName = state.user?.displayName || state.user?.username || username
      return {
        success: true,
        message: `Đăng nhập Valvrare Team thành công! Xin chào ${displayName}.`
      }
    } else {
      return {
        success: false,
        message: 'Đăng nhập không thành công. Vui lòng kiểm tra lại Tài khoản và Mật khẩu.'
      }
    }
  } catch (err) {
    await logger.warn('[Auth] Error in loginAndCheckConnection:', err)
    return {
      success: false,
      message: `Lỗi kết nối Valvrare Team: ${String(err)}`
    }
  }
}

export async function ensureAuthenticatedSession(): Promise<boolean> {
  try {
    if (getCachedToken()) return true
    const token = await loadStoredSession()
    return !!token
  } catch {
    return false
  }
}
