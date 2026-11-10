import { dumpCookies } from "./popup";

export function HomePage({ onNavigate }: any){
    return(
<div className='w-72 p-4 bg-gray-50 rounded-lg shadow-md font-sans'>
      <h2 className='text-xl font-bold mb-2 text-gray-800'>Cookie thing</h2>
      <div className="flex gap-2 mb-4">
        <button className='bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600'
        onClick={dumpCookies}> Dump Cookies </button>
        <button className='bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600'
        onClick={() => onNavigate('cookies')}> View Cookies </button>
      </div>
    </div>
    );
}