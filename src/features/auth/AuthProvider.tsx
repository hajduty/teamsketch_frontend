import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../../types/user';

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
}

interface Props {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<Props> = ({ children }) => {
    const [authenticated, setAuthenticated] = useState<boolean>(() => {
        return !!localStorage.getItem('token');
    });

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [guest, setGuest] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>("");

    useEffect(() => {
        const token = localStorage.getItem('token');
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
    }, []);

    const login = (token: string, user: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setAuthenticated(true);
        setUser(user);
        setToken(token);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setGuest(false);
        setAuthenticated(false);
        setUser(null);
        setToken("");
    };

    return (
        <AuthContext.Provider value={{ authenticated, user, login, logout, setUser, loading, guest, setGuest, token }}>
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