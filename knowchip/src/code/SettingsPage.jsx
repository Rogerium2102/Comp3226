export function SettingsPage({ onBack, darkMode, setDarkMode }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button className="bg-gray-200 text-white w-7 h-7 rounded hover:bg-gray-300 cursor-pointer items-center justify-center inline-flex"
              type="button" onClick={() => onBack()}>
                <img src="/back.png" alt={"back"} className="w-6 h-auto block"></img>
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Settings</h1>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg shadow flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Dark Mode</h2>
          <p className="text-sm text-gray-500 ">Toggle dark theme styling</p>
        </div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-12 h-6 flex items-center rounded-full text-gray-500 p-1 cursor-pointer transition-colors hover:bg-gray-300"
        >
            Toggle
        </button>
      </div>
    </div>
  );
}
