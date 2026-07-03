"use client";

import { useState, useEffect } from "react";
import { HANDBOOK_CONTENT } from "../data/handbookContent";
import { cn } from "@/lib/utils";
import { 
  Info, 
  ShieldAlert, 
  Briefcase, 
  Clock, 
  LogOut, 
  Server, 
  HelpCircle, 
  FileCheck,
  ChevronRight
} from "lucide-react";

interface HandbookSidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
}

const SECTION_ICONS: Record<string, any> = {
  overview: Info,
  "company-policies": ShieldAlert,
  "employment-policies": Briefcase,
  "time-attendance": Clock,
  offboarding: LogOut,
  "it-security": Server,
  faqs: HelpCircle,
  acknowledgment: FileCheck,
};

export function HandbookSidebar({ activeSection, onSectionChange }: HandbookSidebarProps) {
  return (
    <nav className="flex flex-col gap-1">
      {HANDBOOK_CONTENT.map((section) => {
        const Icon = SECTION_ICONS[section.id] || Info;
        const isActive = activeSection === section.id;
        
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("size-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
              <span>{section.title}</span>
            </div>
            {isActive && <ChevronRight className="size-4 animate-in slide-in-from-left-2" />}
          </button>
        );
      })}
    </nav>
  );
}
