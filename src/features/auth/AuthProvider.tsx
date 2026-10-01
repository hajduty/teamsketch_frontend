import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { User } from '../../types/user';
import { isTokenExpired, msUntilExpiry, onSessionExpired } from './session';
import { clearLocalCanvases } from '../canvas/localCanvas';

interface AuthContextType {
    authenticated: boolean;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    /** Use the app without an account; canvases are kept on this device only */
    continueAsGuest: () => void;
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

// Guests have no token, just this marker
export const GUEST_TOKEN = 'none';
// The guest identity stays the same across visits, so guest canvases keep their owner
const GUEST_USER_KEY = 'guestUser';

const guestUser = (): User => {
    try {
        const saved = JSON.parse(localStorage.getItem(GUEST_USER_KEY) || 'null');
        if (saved?.id) return saved;
    } catch {
        // Fall through and make a new one
    }
    const user: User = { id: `guest-${crypto.randomUUID()}`, email: 'Guest' };
    localStorage.setItem(GUEST_USER_KEY, JSON.stringify(user));
    return user;
};

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
    // Known from the first render, so pages don't treat a guest as an account meanwhile
    const [guest, setGuest] = useState<boolean>(initial.token === GUEST_TOKEN);
    const [token, setToken] = useState<string | null>("");
    const [sessionExpired, setSessionExpired] = useState<boolean>(initial.expired);

    useEffect(() => {
        const token = initial.token;
        setAuthenticated(!!token);
        setToken(token!);

        if (token === GUEST_TOKEN) {
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
        setGuest(false);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setAuthenticated(true);
        setUser(user);
        setToken(token);
    };

    const continueAsGuest = useCallback(() => {
        const user = guestUser();
        localStorage.setItem('token', GUEST_TOKEN);
        localStorage.setItem('user', JSON.stringify(user));
        setSessionExpired(false);
        setGuest(true);
        setAuthenticated(true);
        setUser(user);
        setToken(GUEST_TOKEN);
    }, []);

    // Ends the session but keeps this device's copies of the rooms
    const endSession = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setGuest(false);
        setAuthenticated(false);
        setUser(null);
        setToken("");
    }, []);

    // Logging out of an account also removes its rooms from this device (a guest's canvases
    // stay: they exist nowhere else)
    const logout = useCallback(() => {
        if (localStorage.getItem('token') !== GUEST_TOKEN) {
            try {
                const id = JSON.parse(localStorage.getItem('user') || 'null')?.id;
                if (id) clearLocalCanvases(id);
            } catch {
                // No readable user, nothing to clear
            }
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
        if (!token || token === GUEST_TOKEN) return;
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
        const stored = localStorage.getItem('token');
        if (stored && stored !== GUEST_TOKEN) expire();
    }), [expire]);

    return (
        <AuthContext.Provider value={{ authenticated, user, login, logout, continueAsGuest, setUser, loading, guest, setGuest, token, sessionExpired }}>
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