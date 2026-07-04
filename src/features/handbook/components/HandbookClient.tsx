"use client";

import { useState, useEffect, useRef } from "react";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";

import { HANDBOOK_CONTENT } from "../data/handbookContent";
import { HandbookSection } from "./HandbookSection";
import { HandbookSidebar } from "./HandbookSidebar";
import { HandbookAcknowledgment } from "./HandbookAcknowledgment";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, FileCheck } from "lucide-react";

export function HandbookClient() {
  const [activeSection, setActiveSection] = useState(HANDBOOK_CONTENT[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = HANDBOOK_CONTENT.map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(HANDBOOK_CONTENT[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="pb-10">
      <div className="mb-6 space-y-6">
        <EmployeeModuleTopbar 
          searchInputProps={{
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
          }}
        />
        
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-background to-background p-6 border border-primary/10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
          
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-bold tracking-tight">
                <BookOpen className="size-4" />
                <span className="uppercase text-[10px] tracking-[0.2em]">Employee Portal</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Guidelines</h1>
              <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                Your comprehensive guide to company policies, workplace standards, and operational procedures.
              </p>
            </div>
            
            <div className="hidden lg:block">
              <Card className="border-primary/20 bg-background/50 backdrop-blur-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center text-[#161b30]">
                    <FileCheck className="size-5" />
                  </div>
                  <div className="space-y-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Status</p>
                    <p className="text-xs font-semibold text-foreground">v2.1.0 Active</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Sticky Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="space-y-2">
              <p className="px-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Navigation</p>
              <HandbookSidebar 
                activeSection={activeSection} 
                onSectionChange={handleSectionChange} 
              />
            </div>
            
            <Card className="border-border/40 bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Need Assistance?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Can&apos;t find what you&apos;re looking for? Reach out to the HR department for policy clarifications.
                </p>
                <button className="text-xs font-bold text-primary hover:underline">Contact HR Support</button>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Content Area */}
        <div className="space-y-12">
          {HANDBOOK_CONTENT.map((section) => (
            section.id === "acknowledgment" ? (
              <HandbookAcknowledgment key={section.id} />
            ) : (
              <HandbookSection key={section.id} section={section} />
            )
          ))}
          
          <footer className="pt-8 border-t border-border/40 text-center">
            <p className="text-sm text-muted-foreground">
              © 2026 Workzen HRIS. All company policies are subject to periodic review and updates.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
