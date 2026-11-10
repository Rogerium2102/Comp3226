
import { useState } from 'react'
import './App.css'
import { HomePage } from './code/HomePage.tsx';
import { CookiePage } from './code/CookiePage.tsx';
function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'cookies' | 'settings'>('home');
  return (
    <div>
      {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
      {currentPage === 'cookies' && <CookiePage onBack={() => setCurrentPage('home')} />}
      {/* {currentPage === 'settings' && <HomePage onNavigate={setCurrentPage} />} */}
    </div>
  )
}

export default App
