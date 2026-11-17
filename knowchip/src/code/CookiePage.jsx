import { getAll } from "./deletion/recyclingBin";
import { getAllCookies } from "./Storage/CookieHandler";
import { useState, useEffect } from 'react';
import { purgeCookies } from "./deletion/cookieDeleter";
// import { purgeCookie, wipeCookie } from "./deletion/cookieDeleter"

export function CookiePage({ onBack }){
    const [cookies,setCookies] = useState([]);
    async function loadCookies(){
      setCookies([])
      const data = await getAllCookies()
      setCookies(data || [])
    }
    useEffect (() =>{
      loadCookies()
    },[])

    console.log(cookies)
    return(
        <div className="container px-4 py-6">
            <h1>cookie</h1>
            <div>
                <button className="bg-pink-500 text-white px-3 py-1 rounded hover:bg-pink-600" onClick={() => onBack('home')}>Back</button>
                <button className="bg-green-200 text-white px-3 py-1 rounded hover:bg-green-500" onClick={() =>{loadCookies()}}>Refresh</button>
                <button className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600" onClick={()=> {purgeCookies(cookies); loadCookies()}}>Purge cookies</button> 
                 <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
          <thead className="bg-gray-50 font-semibold text-gray-700">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Path</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {cookies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">
                  No cookies found.
                </td>
              </tr>
            ) : (
              cookies.map((cookie, idx) => (
                <tr key={`${cookie.domain}-${cookie.name}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-blue-600 whitespace-nowrap">
                    {cookie.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                    {cookie.domain}
                  </td>
                  <td
                    className="px-4 py-2 font-mono text-xs text-gray-500 max-w-[200px] truncate"
                    title={cookie.value}
                  >
                    {cookie.value}
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {cookie.path}
                  </td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-xs">
                    {cookie.expirationDate && !cookie.session
                      ? new Date(cookie.expirationDate * 1000).toLocaleDateString()
                      : "Session"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      {cookie.httpOnly && (
                        <span className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded font-medium">
                          HttpOnly
                        </span>
                      )}
                      {cookie.secure && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-1.5 py-0.5 rounded font-medium">
                          Secure
                        </span>
                      )}
                      {cookie.sameSite && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded font-medium">
                          {cookie.sameSite}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
            </div>
        </div>
    )
}