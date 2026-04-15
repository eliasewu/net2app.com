import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar />
      <div className="ml-60 transition-all duration-300">
        <TopBar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}