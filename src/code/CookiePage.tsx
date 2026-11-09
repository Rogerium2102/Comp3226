export function CookiePage({ onBack } : any){
    return(
        <div>
            <h1>cookie</h1>
            <div>
                <button onClick={() => {onBack('home')}}>Back</button>
            </div>
        </div>
    )
}