import { ReactNode, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAppContext } from "@/context/AppContext";
import { useLocation } from "wouter";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { setActivePage, closeNav } = useAppContext();
  const [location] = useLocation();

  // Update the active page based on the current location
  useEffect(() => {
    const path = location === "/" ? "dashboard" : location.substring(1);
    setActivePage(path);
  }, [location, setActivePage]);

  // Close the mobile nav when the window is resized
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        closeNav();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [closeNav]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-grow flex flex-col overflow-hidden">
        <Header />
        <div className="flex-grow overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
