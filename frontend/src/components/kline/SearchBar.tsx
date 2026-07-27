import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { marketAPI } from "@/services/market";
import type { SearchItem } from "@/types/kline";

interface SearchBarProps {
  onSelect: (item: SearchItem) => void;
  placeholder?: string;
}

export function SearchBar({ onSelect, placeholder = "搜索股票/基金代码或名称" }: SearchBarProps) {
  const [keyword, setKeyword] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["search", keyword],
    queryFn: () => marketAPI.search(keyword),
    enabled: keyword.length >= 1,
    staleTime: 30000,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: SearchItem) => {
    onSelect(item);
    setKeyword(item.name);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {showDropdown && keyword && data?.items.length ? (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
          {data.items.map((item) => (
            <button
              key={item.code}
              onClick={() => handleSelect(item)}
              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between border-b border-border last:border-b-0"
            >
              <div>
                <div className="font-medium text-slate-800">{item.name}</div>
                <div className="text-xs text-slate-400">{item.code}</div>
              </div>
              <span className="text-xs text-slate-400">
                {item.type === "stock" ? "股票" : item.type}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
