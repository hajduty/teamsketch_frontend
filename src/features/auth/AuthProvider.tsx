import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { User } from '../../types/user';
import { isTokenExpired, msUntilExpiry, onSessionExpired } from './session';
import { clearLocalCanvases } from '../canvas/localCanvas';

interface AuthContextType {
    authenticated: boolean;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    setUser: (user: User | null) => void;
    loading: boolean;
    guest: boolean;
    setGuest: (state: boolean) => void;
    token: string | null;
    // The last logout happened because the token expired
    sessionExpired: boolean;
}

interface Props {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Longest delay setTimeout supports (~24.8 days); longer waits are re-checked when it fires
const MAX_TIMEOUT_MS = 2_147_483_647;

/** The stored token, after dropping it (and the user) if it has already expired. */
const readStoredToken = () => {
    const token = localStorage.getItem('token');
    if (token && isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { token: null, expired: true };
    }
    return { token, expired: false };
};

export const AuthProvider: React.FC<Props> = ({ children }) => {
    // Read once: this also clears an expired token, so a second read couldn't tell it expired
    const [initial] = useState(readStoredToken);
    const [authenticated, setAuthenticated] = useState<boolean>(!!initial.token);

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [guest, setGuest] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>("");
    const [sessionExpired, setSessionExpired] = useState<boolean>(initial.expired);

    useEffect(() => {
        const token = initial.token;
        setAuthenticated(!!token);
        setToken(token!);

        if (token == "none") {
            setGuest(true);
        }

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        setLoading(false);
    }, [initial.token]);

    const login = (token: string, user: User) => {
        setSessionExpired(false);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setAuthenticated(true);
        setUser(user);
        setToken(token);
    };

    // Ends the session but keeps this device's copies of the rooms
    const endSession = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setGuest(false);
        setAuthenticated(false);
        setUser(null);
        setToken("");
    }, []);

    // Logging out also removes the account's rooms from this device
    const logout = useCallback(() => {
        try {
            const id = JSON.parse(localStorage.getItem('user') || 'null')?.id;
            if (id) clearLocalCanvases(id);
        } catch {
            // No readable user, nothing to clear
        }
        endSession();
    }, [endSession]);

    // An expired session keeps the cached rooms, so changes made offline can still sync after
    // logging back in
    const expire = useCallback(() => {
        setSessionExpired(true);
        endSession();
    }, [endSession]);

    // Log out when the token expires. Timers don't run reliably in background or sleeping
    // tabs, so also check whenever the tab comes back.
    useEffect(() => {
        if (!token) return;
        const check = () => {
            if (isTokenExpired(token)) expire();
        };
        const wait = msUntilExpiry(token);
        const timer = wait === null ? undefined : setTimeout(check, Math.min(wait, MAX_TIMEOUT_MS));
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', check);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', check);
        };
    }, [token, expire]);

    // The server rejected the token (401), e.g. it was revoked or the clocks disagree
    useEffect(() => onSessionExpired(() => {
        if (localStorage.getItem('token')) expire();
    }), [expire]);

    return (
        <AuthContext.Provider value={{ authenticated, user, login, logout, setUser, loading, guest, setGuest, token, sessionExpired }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};