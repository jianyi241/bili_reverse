import { Route, Routes } from 'react-router-dom'
import { UserProvider } from './context/UserContext.jsx'
import LoginModal from './components/LoginModal.jsx'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Watch from './pages/Watch.jsx'
import Fav from './pages/Fav.jsx'
import Me from './pages/Me.jsx'

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/watch/:bvid" element={<Watch />} />
        <Route path="/fav" element={<Fav />} />
        <Route path="/me" element={<Me />} />
        <Route
          path="*"
          element={<div className="grid min-h-screen place-items-center text-[14px] text-fg-3">404 · 页面不存在</div>}
        />
      </Routes>
      <LoginModal />
    </UserProvider>
  )
}
