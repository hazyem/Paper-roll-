import { createContext, useContext, ReactNode, useState } from "react";

interface AppContextType {
  activePage: string;
  setActivePage: (page: string) => void;
  navOpen: boolean;
  toggleNav: () => void;
  closeNav: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [activePage, setActivePage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const toggleNav = () => setNavOpen(prev => !prev);
  const closeNav = () => setNavOpen(false);

  return (
    <AppContext.Provider 
      value={{ 
        activePage, 
        setActivePage,
        navOpen,
        toggleNav,
        closeNav
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
