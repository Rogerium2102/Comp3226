
import { useState, useEffect } from 'react'
import './App.css'
import { HomePage } from './code/HomePage.jsx';
import { CookiePage } from './code/CookiePage.jsx';
import { SettingsPage } from './code/SettingsPage.jsx';
function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
  return (
    <div className='w-[700px] min-h-[500px] bg-white text-gray-900 transition-colors'>
      {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
      {currentPage === 'cookies' && <CookiePage onBack={() => setCurrentPage('home')} />}
      {currentPage === 'settings' && <SettingsPage onBack={() => setCurrentPage('home')} darkMode={darkMode} setDarkMode={setDarkMode} />}
    </div>
  );
}

export default App
