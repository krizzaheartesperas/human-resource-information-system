"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type HandbookSection as HandbookSectionType } from "../data/handbookContent";
import { cn } from "@/lib/utils";
import { Info, HelpCircle } from "lucide-react";

interface HandbookSectionProps {
  section: HandbookSectionType;
}

export function HandbookSection({ section }: HandbookSectionProps) {
  return (
    <div id={section.id} className="scroll-mt-24 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {section.infoBlock && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap gap-6 py-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</p>
              <p className="text-sm font-semibold">{section.infoBlock.version}</p>
            </div>
            <div className="space-y-1 border-l border-border/50 pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Effective Date</p>
              <p className="text-sm font-semibold">{section.infoBlock.effectiveDate}</p>
            </div>
            <div className="space-y-1 border-l border-border/50 pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Updated</p>
              <p className="text-sm font-semibold">{section.infoBlock.lastUpdated}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {section.content && !Array.isArray(section.content) && (
        <p className="text-muted-foreground leading-relaxed">{section.content}</p>
      )}

      {section.content && Array.isArray(section.content) && (
        <div className="space-y-4">
          {section.content.map((p, i) => (
            <p key={i} className="text-muted-foreground leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      )}

      {section.subsections && (
        <div className="grid gap-6">
          {section.subsections.map((sub, i) => (
            <Card key={i} className="overflow-hidden border-border/60 bg-card/50 transition-all hover:border-primary/30">
              <CardHeader className="bg-muted/30 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  {sub.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {Array.isArray(sub.content) ? (
                  <ul className="space-y-3">
                    {sub.content.map((item, j) => (
                      <li key={j} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {j + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">{sub.content}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {section.faqs && (
        <div className="grid gap-4">
          {section.faqs.map((faq, i) => (
            <Card key={i} className="border-border/60 bg-card/50">
              <CardContent className="flex gap-4 p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <HelpCircle className="size-5" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">{faq.question}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
