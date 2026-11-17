export interface ChromeCookie {
    name: string
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: "no_restriction" | "lax" | "strict" | "unspecified" | string;
    session: boolean;
    expirationDate?: number;
    storeId?: string;
    hostOnly?: boolean;
}