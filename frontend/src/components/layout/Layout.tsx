import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-white py-4 text-center text-sm text-slate-400">
        投资助手 © 2024 | 仅供个人投资参考，不构成投资建议
      </footer>
    </div>
  );
}
