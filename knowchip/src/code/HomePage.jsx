import {Settings, Cookie, ShieldCheck} from "lucide-react";
import logo from "../assets/CookieLogo.png"

export function HomePage({ onNavigate }){
    return(
        <div className="w-[380px bg-zinc-950 text-zinc-100 p-4 font-sans flex flex-col gap-3.5 select-none">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <ShieldCheck className="w-4 h-4"/>
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none inline-flex items-center">
                            <span>kn</span>
                            <img
                                src={logo}
                                alt="o"
                                className="w-3.5 h-3.5 mx-[0.5px] inline-block object-contain"
                            />
                            <span>wchip</span>
                        </h1>
                    </div>
                </div>
            </header>
        </div>
    );
}