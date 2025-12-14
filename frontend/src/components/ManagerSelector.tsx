"use client";

import { useState, useEffect } from "react";
import { ChevronDown, User } from "lucide-react";
import { getManagers, getSelectedManagerId, setSelectedManagerId, Manager } from "@/lib/managerApi";

interface ManagerSelectorProps {
    onManagerChange?: (managerId: string) => void;
}

export default function ManagerSelector({ onManagerChange }: ManagerSelectorProps) {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadManagers();
    }, []);

    const loadManagers = async () => {
        try {
            const data = await getManagers();
            setManagers(data);

            // Check for previously selected manager
            const savedId = getSelectedManagerId();
            if (savedId) {
                const saved = data.find(m => m.id === savedId);
                if (saved) {
                    setSelectedManager(saved);
                }
            } else if (data.length > 0) {
                // Auto-select first manager
                setSelectedManager(data[0]);
                setSelectedManagerId(data[0].id);
                onManagerChange?.(data[0].id);
            }
        } catch (err) {
            console.error("Failed to load managers:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (manager: Manager) => {
        setSelectedManager(manager);
        setSelectedManagerId(manager.id);
        setIsOpen(false);
        onManagerChange?.(manager.id);
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl animate-pulse">
                <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="w-24 h-4 bg-white/10 rounded"></div>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                    <div className="text-xs text-white/40 uppercase tracking-wider">Viewing as</div>
                    <div className="text-sm text-white font-medium">
                        {selectedManager?.name || "Select Manager"}
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="p-2 border-b border-white/5">
                        <div className="text-xs text-white/40 uppercase tracking-wider px-2 py-1">
                            Hiring Managers
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {managers.map((manager) => (
                            <button
                                key={manager.id}
                                onClick={() => handleSelect(manager)}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${selectedManager?.id === manager.id ? 'bg-white/10' : ''
                                    }`}
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500/50 to-blue-500/50 rounded-full flex items-center justify-center">
                                    <span className="text-xs text-white font-medium">
                                        {manager.name.split(' ').map(n => n[0]).join('')}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-sm text-white">{manager.name}</div>
                                    <div className="text-xs text-white/40">{manager.team} · {manager.department}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
