import { getAllCookies, invalidateCache } from "./Storage/CookieHandler";
import { useState, useEffect, Fragment } from 'react';
import { purgeCookies, purgeCookie } from "./deletion/deleterInExtWrld";
// import { purgeCookie, wipeCookie } from "./deletion/cookieDeleter"

export function CookiePage({ onBack }){
    const [cookies,setCookies] = useState([]);
    const [expandedKey, setExpandedKey] = useState("");
    const [open, setOpen] = useState(false);
    async function loadCookies(){
      console.log("reloading cookies")
      await invalidateCache()
      const data = await getAllCookies()
      setCookies(data || [])
    }
    useEffect (() =>{
      loadCookies()
    },[])

    console.log(cookies)
    return(
      <div className="container px-2 py-6 mx-auto">
        <button className="bg-gray-200 text-white w-7 h-7 rounded hover:bg-gray-300 cursor-pointer items-center justify-center inline-flex"
              type="button" onClick={() => onBack('home')}>
                <img src="/back.png" alt={"back"} className="w-6 h-auto block"></img>
        </button>
        <div className="text-center">
          <h1 className="text-lg text-black">Your Cookies</h1>
        </div>
          <div className="space-y-2">
              <button className="bg-blue-200 text-white w-7 h-7 rounded hover:bg-blue-300 cursor-pointer items-center justify-center inline-flex"
              type="button" onClick={()=>{setOpen(true);}}>
                <img src="/info.png" alt={"info"} className="w-6 h-auto block"></img>
              </button>
              {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                 onClick={() => setOpen(false)}>
                  <div className="bg-white rounded-xl shadow-2xl max-w-m w-full p-6 text-gray-800 space-y-4"
                   onClick={(e) => e.stopPropagation()}>
                    <h1 className="text-blue-500 font-bold text-center">Information</h1>
                    <p>The table describes the Name of the cookie and the domain (where it came from). The flags describe certain properties of the cookie e.g.</p>
                    <table className="w-full divide-y divide-x divide-gray-200 text-sm text-left py-2 gap-4">
                      <thead>
                        <tr>
                          <th className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              HttpOnly</th>
                          <th className="bg-emerald-100 text-emerald-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              Secure</th>
                          <th className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded font-medium">
                            Samesite</th>
                          <th className="bg-pink-100 text-pink-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              HostOnly</th>
                          <th className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              Session</th>
                        </tr>
                      </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td>Blocks JavaScript from reading or modifying the cookie</td>
                        <td>Tells the browser to send the cookie only over encrypted connections (safer)</td>
                        <td>Controls whether a browser sends the cookie with cross-site requests. i.e requesting from a different website than your on</td>
                        <td>Restrics the browser so it can only send this cookie to the host that set it</td>
                        <td>These are important and essential to interact with login features</td>
                      </tr>
                        </tbody>
                    </table>
                    <div className="flex gap-3">
                    <button type="button" className="bg-red-400 text-white w-7 h-7 rounded items-center justify-center inline-flex" 
                    onClick={()=> {purgeCookies(cookies); loadCookies()}}>
                      <img src="/bin.png" alt={"bin"} className="w-6 h-auto block"></img>
                    </button>    
                    <button type="button" className=" bg-red-400 image-button rounded w-7 h-7 items-center justify-center inline-flex">
                        <img src="/delete.png" alt={"delete"} className="w-50 h-auto"></img>
                    </button>
                      <p>Delete all cookies/ delete a cookie</p>
                    </div>
                    <div className="flex gap-3">
                    <button type="button" className="bg-green-400 text-white w-7 h-7 rounded items-center justify-center inline-flex" >
                      <img src="/refresh.png" alt={"refresh"} className="w-6 h-auto block"></img>
                    </button>
                    <p>This refreshes the table and presents all your current cookies</p>
                  </div>
                    <button className="bg-gray-200 text-white w-7 h-7 rounded hover:bg-gray-300 cursor-pointer items-center justify-center inline-flex"
                    type="button" onClick={() => setOpen(false)}>
                      <img src="/back.png" alt={"back"} className="w-6 h-auto block"></img>
                    </button>
                  </div>
                </div>
                )}
              <button type="button" className="bg-green-400 text-white w-7 h-7 cursor-pointer rounded hover:bg-green-500 items-center justify-center inline-flex" 
              onClick={() =>{loadCookies()}}>
                <img src="/refresh.png" alt={"refresh"} className="w-6 h-auto block"></img>
              </button>
              <button type="button" className="bg-red-400 text-white w-7 h-7 cursor-pointer rounded hover:bg-red-500 items-center justify-center inline-flex" 
              onClick={()=> {purgeCookies(cookies); loadCookies()}}>
                <img src="/bin.png" alt={"bin"} className="w-6 h-auto block"></img>
              </button>
          <div className="text-center">
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
              <table className="w-full divide-y divide-gray-200 text-sm text-left py-2">

                <thead className="bg-gray-50 font-semibold text-gray-700">
                  <tr>
                    <th className="px-2 py-2 w-20">-</th>
                    <th className="px-2 py-2 w-20">Name</th>
                    <th className="px-2 py-2 w-20">Domain</th>
                    <th className="px-2 py-2 w-24">Flags</th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                  {cookies.length === 0 ? (
                    <tr onClick={()=> {}}>
                      <td colSpan={6} className="px-2 py-6 text-center text-gray-400 italic">
                        No cookies found.
                      </td>
                    </tr>
                ) : (
                cookies.map((cookie, idx) => {
                const cookieKey = `${cookie.domain}-${cookie.name}-${idx}`;
                const isExpanded = expandedKey === cookieKey

                return (
                  <Fragment key={cookieKey}>
                  <tr onClick={() => setExpandedKey(isExpanded ? null : cookieKey)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-2 truncate">
                      <div> 
                        <button onClick={(e)=> {
                          e.stopPropagation();
                          purgeCookie(cookie)
                          loadCookies();
                          }}  type="button" className="bg-yellow-400 cursor-pointer image-button rounded hover:bg-yellow-500 w-7 h-7">
                          <img src="/delete.png" alt={"delete"} className="w-50 h-auto"></img>
                        </button>
                        {/* <button onClick={(e)=> {
                          e.stopPropagation();
                          wipeCookie(cookie)
                          loadCookies()
                          }}  type="button" class="bg-yellow-400 cursor-pointer hover:bg-yellow-500 rounded image-button w-7 h-7">
                          <img src="/scissors.png" class="w-50 h-auto"></img>
                        </button> */}
                     </div>
                   </td>
                   <td className="px-2 py-2 truncate font-medium text-blue-600 max-w-30">
                    {cookie.name}
                   </td>
                   <td className="px-2 py-2 truncate text-gray-600 max-w-30">
                    {cookie.domain}
                   </td>
                    <td className="px-2 py-2 truncate">
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
                          {cookie.session && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              Session
                            </span>
                          )}
                          {cookie.hostOnly && (
                            <span className="bg-pink-100 text-pink-800 text-xs px-1.5 py-0.5 rounded font-medium">
                              HostOnly
                            </span>
                          )}
                        </div>
                      </td>
                  </tr>

                  {isExpanded && (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td colSpan={4} className="p-3 text-xs">
                      {/* Value Container */}
                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1 text-gray-500 font-semibold">
                          <span>Full Value:</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(cookie.value)}
                            className="text-blue-500 hover:underline text-[11px]"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="bg-white border border-gray-200 p-2 rounded font-mono text-[11px] text-gray-700 break-all max-h-24 overflow-y-auto">
                          {cookie.value}
                        </div>
                      </div>
                      {/* Metadata Strip */}
                      <div className="flex flex-wrap gap-4 text-gray-600 pt-1 border-t border-gray-200/60">
                        <div>
                          <span className="font-semibold text-gray-700">Name:</span> {cookie.name}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Domain:</span> {cookie.domain}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Path:</span> {cookie.path || "/"}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Expires:</span>{" "}
                          {cookie.expirationDate && !cookie.session
                            ? new Date(cookie.expirationDate * 1000).toLocaleString()
                            : "Session"}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">SameSite:</span>{" "}
                          {cookie.sameSite || "None"}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                  </Fragment>
                )
               })
            )}
          </tbody>
        </table>
      </div>
            </div>
        </div>
  </div>
    )
}