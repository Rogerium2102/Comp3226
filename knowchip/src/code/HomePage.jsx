import { dumpCookies } from "./popup";
import { getAllStorageFromTabs } from "./Storage/SessionHandler";
import { useEffect } from "react";

export function HomePage({ onNavigate }){
  useEffect(() => {
    async function bs(){
      let storage = await getAllStorageFromTabs()
      console.log(" THIS IS THE STORAGE PLUH")
      console.log(storage) 
    }
    bs()}
  ,[])
    return(
    <div className='px-4 py-4 bg-gray-50 rounded-lg shadow-md font-sans justify-center flex items-center flex-col'>
      <h2 className='text-xl font-bold mb-2 text-gray-800'>Home Page</h2>
      <div> 
        <button className='bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600'
        onClick={() => onNavigate('cookies')}> View Cookies </button>
        <button className="bg-gray-100 text-white w-7 h-7 rounded hover:bg-blue-200 cursor-pointer items-center justify-center inline-flex"
        type="button" onClick={()=> {onNavigate('settings')}}>
        <img src="/settings.png" alt={"info"} className="w-6 h-auto block"></img> 
        </button>
      </div>
    </div>
    );
}