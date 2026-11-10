import { getAllCookies } from "./Storage/CookieHandler"
// import { purgeCookie, wipeCookie } from "./deletion/cookieDeleter"


export function CookiePage({ onBack } : any){
    return(
        <div className="container px-4 py-6">
            <h1>cookie</h1>
            <div>
                <button className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600" onClick={() => displayCookie()}>Dump cookies</button>
                <button className="bg-pink-500 text-white px-3 py-1 rounded hover:bg-pink-600" onClick={() => onBack('home')}>Back</button>
            </div>
        </div>
    )
}

function displayCookie(){
    const cookies = getAllCookies()
    console.log(cookies)
}