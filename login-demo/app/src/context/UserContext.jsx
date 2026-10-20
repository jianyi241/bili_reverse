import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const Ctx = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginOpen, setLoginOpen] = useState(false)

  const refresh = useCallback(async () => {
    const j = await api.me()
    setUser(j.ok ? j.user : null)
    setLoading(false)
    return j.ok ? j.user : null
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.reset()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, refresh, logout, loginOpen, setLoginOpen, openLogin: () => setLoginOpen(true) }),
    [user, loading, refresh, logout, loginOpen]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUser() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUser 必须在 UserProvider 内使用')
  return v
}
