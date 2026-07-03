"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  FileImage,
  Files,
  Forward,
  Paperclip,
  Pin,
  Info,
  MessageCircleMore,
  MoreHorizontal,
  PencilLine,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { CurrentUser } from "@/lib/mock";
import {
  deleteEmployeeChatMessage,
  ensureEmployeeChatConversation,
  editEmployeeChatMessage,
  forwardEmployeeChatMessage,
  loadEmployeeChatConversations,
  markEmployeeConversationAsRead,
  saveEmployeeChatConversations,
  sendEmployeeChatAttachment,
  sendEmployeeChatMessage,
  toggleEmployeeChatMessagePin,
  type EmployeeChatConversation,
  type EmployeeChatMessage,
} from "@/features/chat/services/employeeChat.service";

type EmployeeMessengerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser;
  managerName?: string;
  initialParticipantName?: string | null;
};

function formatChatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatSidebarTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickInitialConversationId(
  conversations: EmployeeChatConversation[],
  initialParticipantName?: string | null
) {
  if (initialParticipantName) {
    const target = conversations.find(
      (conversation) =>
        conversation.participant.name.toLowerCase() === initialParticipantName.toLowerCase()
    );
    if (target) return target.id;
  }
  return conversations[0]?.id ?? null;
}

export function EmployeeMessengerDialog({
  open,
  onOpenChange,
  user,
  managerName,
  initialParticipantName,
}: EmployeeMessengerDialogProps) {
  const initialConversations = user.employeeId
    ? ensureEmployeeChatConversation({
        conversations: loadEmployeeChatConversations({
          employeeId: user.employeeId,
          employeeName: user.name,
          managerName,
        }),
        employeeId: user.employeeId,
        employeeName: user.name,
        managerName,
        participantName: initialParticipantName,
      })
    : [];
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<NonNullable<EmployeeChatMessage["attachment"]> | null>(null);
  const [conversations, setConversations] = useState<EmployeeChatConversation[]>(() => initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    user.employeeId
      ? pickInitialConversationId(initialConversations, initialParticipantName)
      : null
  );
  const [view, setView] = useState<"list" | "thread">(() =>
    initialParticipantName ? "thread" : "list"
  );
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user.employeeId || conversations.length === 0) return;
    saveEmployeeChatConversations(user.employeeId, conversations);
  }, [conversations, user.employeeId]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) =>
      query
        ? `${conversation.participant.name} ${conversation.participant.role} ${conversation.topic} ${
            conversation.messages.at(-1)?.text ?? ""
          }`
            .toLowerCase()
            .includes(query)
        : true
    );
  }, [conversations, search]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    filteredConversations[0] ??
    null;
  const activeConversationMedia = activeConversation?.messages.filter(
    (message) => message.attachment?.kind === "image"
  ) ?? [];
  const activeConversationFiles = activeConversation?.messages.filter(
    (message) => message.attachment?.kind === "document"
  ) ?? [];
  const activeConversationLinks = activeConversation?.messages.filter((message) =>
    /(https?:\/\/|www\.)/i.test(message.text)
  ) ?? [];
  const pinnedMessage =
    activeConversation?.messages.find((message) => message.pinned) ??
    null;

  const handleSelectConversation = (conversationId: string) => {
    if (!user.employeeId) {
      setActiveConversationId(conversationId);
      setView("thread");
      return;
    }
    setConversations((current) =>
      markEmployeeConversationAsRead(current, user.employeeId, conversationId)
    );
    setActiveConversationId(conversationId);
    setView("thread");
    setAttachmentMenuOpen(false);
    setShowConversationInfo(false);
    setOpenMessageMenuId(null);
    setEditingMessageId(null);
    setEditingDraft("");
    setForwardingMessageId(null);
  };

  const handleSend = () => {
    if (!user.employeeId || !activeConversation) return;
    const next = sendEmployeeChatMessage({
      conversations,
      conversationId: activeConversation.id,
      employeeId: user.employeeId,
      employeeName: user.name,
      text: draft,
    });
    if (next === conversations) return;
    setConversations(next);
    setDraft("");
  };

  const handleAttachmentChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "image" | "document"
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setAttachmentMenuOpen(false);
    if (!file || !user.employeeId || !activeConversation) return;
    if (kind === "document") {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return;
    }

    const fileUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!fileUrl) return;

    const next = sendEmployeeChatAttachment({
      conversations,
      conversationId: activeConversation.id,
      employeeId: user.employeeId,
      employeeName: user.name,
      attachment: {
        kind,
        name: file.name,
        mimeType: file.type || (kind === "image" ? "image/*" : "application/octet-stream"),
        url: fileUrl,
        sizeLabel: formatBytes(file.size),
      },
    });
    if (next === conversations) return;
    setConversations(next);
  };

  const handleStartEdit = (message: EmployeeChatMessage) => {
    setEditingMessageId(message.id);
    setEditingDraft(message.text);
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardingMessageId(null);
  };

  const handleSaveEdit = () => {
    if (!activeConversation || !editingMessageId) return;
    const next = editEmployeeChatMessage({
      conversations,
      conversationId: activeConversation.id,
      messageId: editingMessageId,
      text: editingDraft,
    });
    if (next === conversations) return;
    setConversations(next);
    setEditingMessageId(null);
    setEditingDraft("");
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!activeConversation) return;
    setConversations((current) =>
      deleteEmployeeChatMessage({
        conversations: current,
        conversationId: activeConversation.id,
        messageId,
      })
    );
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardingMessageId(null);
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setEditingDraft("");
    }
  };

  const handleForwardMessage = (targetConversationId: string) => {
    if (!activeConversation || !forwardingMessageId || !user.employeeId) return;
    setConversations((current) =>
      forwardEmployeeChatMessage({
        conversations: current,
        sourceConversationId: activeConversation.id,
        targetConversationId,
        messageId: forwardingMessageId,
        employeeId: user.employeeId,
        employeeName: user.name,
      })
    );
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardingMessageId(null);
  };

  const handleTogglePinMessage = (messageId: string) => {
    if (!activeConversation) return;
    setConversations((current) =>
      toggleEmployeeChatMessagePin({
        conversations: current,
        conversationId: activeConversation.id,
        messageId,
      })
    );
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardingMessageId(null);
  };

  const handleDeleteConversation = () => {
    if (!activeConversationId) return;
    const remaining = conversations.filter((conversation) => conversation.id !== activeConversationId);
    setConversations(remaining);
    setShowConversationInfo(false);
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    setForwardingMessageId(null);
    setEditingMessageId(null);
    setEditingDraft("");
    if (remaining.length === 0) {
      setView("list");
      setActiveConversationId(null);
      return;
    }
    setActiveConversationId(remaining[0]?.id ?? null);
    setView("thread");
  };

  const renderAttachment = (message: EmployeeChatMessage, mine: boolean) => {
    if (!message.attachment) return null;
    if (message.attachment.kind === "image") {
      return (
        <button
          type="button"
          onClick={() => setPreviewImage(message.attachment ?? null)}
          className={cn(
            "mt-2 block w-full overflow-hidden rounded-[18px] border text-left",
            mine ? "border-white/30" : "border-[#D8E0F3] dark:border-white/10"
          )}
        >
          <div className="relative h-64 w-full">
            <Image
              src={message.attachment.url}
              alt={message.attachment.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2 text-xs",
              mine ? "bg-white/10 text-white" : "bg-white text-[#42526E] dark:bg-white/5 dark:text-slate-200"
            )}
          >
            <span className="truncate">{message.attachment.name}</span>
            <span className="shrink-0">{message.attachment.sizeLabel}</span>
          </div>
        </button>
      );
    }

    return (
      <a
        href={message.attachment.url}
        download={message.attachment.name}
        className={cn(
          "mt-2 flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left",
          mine
            ? "border-white/30 bg-white/10 text-white"
            : "border-[#D8E0F3] bg-white text-[#42526E] dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            mine ? "bg-white/15 text-white" : "bg-[#EEF3FF] text-[#192853] dark:bg-white/10 dark:text-slate-100"
          )}
        >
          <Paperclip className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{message.attachment.name}</p>
          <p className={cn("text-xs", mine ? "text-white/80" : "text-muted-foreground")}>
            {message.attachment.sizeLabel}
          </p>
        </div>
      </a>
    );
  };

  if (!open) return null;

  return (
    <>
      {previewImage?.kind === "image" ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0F172A]/70 p-4 backdrop-blur-sm">
          <div className="relative w-[min(92vw,760px)] overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.4)] dark:bg-[#11162A]">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#192853] shadow-sm transition-colors hover:bg-white dark:bg-[#11162A]/90 dark:text-white dark:hover:bg-[#11162A]"
              aria-label="Close image preview"
            >
              <X className="size-4" />
            </button>
            <div className="relative aspect-[4/3] w-full bg-slate-950">
              <Image
                src={previewImage.url}
                alt={previewImage.name}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{previewImage.name}</p>
                <p className="text-xs text-muted-foreground">{previewImage.sizeLabel}</p>
              </div>
              <a
                href={previewImage.url}
                download={previewImage.name}
                className="rounded-full bg-[#7C3AED] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#6D28D9]"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}
      {openMessageMenuId && messageMenuPosition && activeConversation ? (
        <div
          className="fixed inset-0 z-[115]"
          onClick={() => {
            setOpenMessageMenuId(null);
            setMessageMenuPosition(null);
            setForwardingMessageId(null);
          }}
        >
          <div
            className="fixed z-[116] w-44 max-h-[50vh] overflow-y-auto rounded-2xl border border-[#D8E0F3] bg-white p-2 shadow-[0_16px_40px_rgba(25,40,83,0.18)] dark:border-white/10 dark:bg-[#11162A]"
            style={{ left: messageMenuPosition.left, bottom: messageMenuPosition.bottom }}
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const menuMessage = activeConversation.messages.find((message) => message.id === openMessageMenuId);
              const forwardTargets = conversations.filter(
                (conversation) => conversation.id !== activeConversation.id
              );
              if (!menuMessage) return null;

              return (
                <>
                  {!menuMessage.attachment ? (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(menuMessage)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <PencilLine className="size-4 text-[#7C3AED]" />
                      <span>Edit</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleTogglePinMessage(menuMessage.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <Pin className="size-4 text-[#7C3AED]" />
                    <span>{menuMessage.pinned ? "Unpin" : "Pin"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForwardingMessageId((current) => (current === menuMessage.id ? null : menuMessage.id))
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <Forward className="size-4 text-[#7C3AED]" />
                    <span>Forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(menuMessage.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-4" />
                    <span>Delete</span>
                  </button>
                  {forwardingMessageId === menuMessage.id ? (
                    <div className="mt-2 space-y-1 border-t border-[#D8E0F3] pt-2 dark:border-white/10">
                      {forwardTargets.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => handleForwardMessage(conversation.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <div
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                              conversation.participant.avatarColor
                            )}
                          >
                            {conversation.participant.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <span className="truncate">{conversation.participant.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
      <div className="fixed bottom-5 right-5 z-[100] w-[min(92vw,420px)]">
        <div className="flex h-[640px] max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden rounded-[28px] border border-[#D8E0F3] bg-white shadow-[0_22px_60px_rgba(25,40,83,0.18)] dark:border-white/10 dark:bg-[#11162A]">
        {showConversationInfo && activeConversation ? (
          <div className="absolute inset-0 z-[120] overflow-y-auto bg-white/98 p-5 backdrop-blur-sm dark:bg-[#11162A]/98">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-medium",
                    activeConversation.participant.avatarColor
                  )}
                >
                  {activeConversation.participant.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">
                    {activeConversation.participant.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{activeConversation.participant.role}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setShowConversationInfo(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[#D8E0F3] bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#192853] dark:bg-white/10 dark:text-slate-100">
                    <Files className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">View Media, Files, Links</p>
                    <p className="text-xs text-muted-foreground">
                      {activeConversationMedia.length} media, {activeConversationFiles.length} files, {activeConversationLinks.length} links
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-[#D8E0F3] bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-[#161b30]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Media</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{activeConversationMedia.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#D8E0F3] bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-[#161b30]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Files</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{activeConversationFiles.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#D8E0F3] bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-[#161b30]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Links</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{activeConversationLinks.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D8E0F3] bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#192853] dark:bg-white/10 dark:text-slate-100">
                    <Pin className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Pinned Message</p>
                    <p className="text-xs text-muted-foreground">
                      {pinnedMessage ? "Reference message in this chat" : "No pinned message available"}
                    </p>
                  </div>
                </div>
                {pinnedMessage ? (
                  <div className="mt-4 rounded-2xl border border-[#D8E0F3] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#161b30]">
                    <p className="text-xs font-medium text-foreground">{pinnedMessage.senderName}</p>
                    <p className="mt-1 text-sm text-foreground">{pinnedMessage.text}</p>
                    {pinnedMessage.attachment ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Attached: {pinnedMessage.attachment.name}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                    <Trash2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Delete Chat</p>
                    <p className="text-xs text-rose-600/80 dark:text-rose-200/80">
                      Remove this conversation from your local chat inbox.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteConversation}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                >
                  <ExternalLink className="size-3.5" />
                  Delete This Chat
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {view === "list" ? (
          <>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#192853] dark:bg-white/10 dark:text-slate-100">
                  <MessageCircleMore className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Chats</p>
                  <p className="text-xs text-muted-foreground">Messenger-style employee support threads</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="border-b border-border/60 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats"
                  className="h-11 rounded-full border-[#D8E0F3] bg-white pl-9 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus-visible:ring-0 dark:bg-white/5"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredConversations.map((conversation) => {
                const lastMessage = conversation.messages.at(-1);
                const unreadCount = conversation.messages.filter(
                  (message) => message.senderId !== user.employeeId && !message.read
                ).length;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectConversation(conversation.id)}
                    className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-medium",
                        conversation.participant.avatarColor
                      )}
                    >
                      {conversation.participant.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {conversation.participant.name}
                        </p>
                        {lastMessage ? (
                          <span className="text-[11px] text-muted-foreground">
                            {formatSidebarTime(lastMessage.sentAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{conversation.participant.role}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {lastMessage?.text ?? conversation.topic}
                      </p>
                    </div>
                    {unreadCount > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[10px] font-medium text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {filteredConversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No conversations match your search.
                </div>
              ) : null}
            </div>
          </>
        ) : activeConversation ? (
          <>
            <div className="flex items-center justify-between border-b-2 border-[#7C3AED] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-[#7C3AED]"
                  onClick={() => setView("list")}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                    activeConversation.participant.avatarColor
                  )}
                >
                  {activeConversation.participant.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {activeConversation.participant.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activeConversation.participant.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-[#7C3AED]"
                  onClick={() => setShowConversationInfo(true)}
                >
                  <Info className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-white px-4 py-4 dark:bg-[#11162A]">
              <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/10">
                  {formatSidebarTime(activeConversation.messages[0]?.sentAt ?? new Date().toISOString())}
                </span>
                <span>{activeConversation.participant.name} joined this channel.</span>
              </div>

              {activeConversation.messages.map((message) => {
                const mine = message.senderId === user.employeeId;
                const isEditing = editingMessageId === message.id;
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[78%]", mine ? "items-end" : "items-start")}>
                      {!mine ? (
                        <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                          {message.senderName}
                        </p>
                      ) : null}
                      <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                        {!mine ? (
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                              activeConversation.participant.avatarColor
                            )}
                          >
                            {activeConversation.participant.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                        ) : null}
                        <div className="relative">
                          {mine ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                setOpenMessageMenuId((current) => {
                                  const nextId = current === message.id ? null : message.id;
                                  setMessageMenuPosition(
                                    nextId
                                      ? {
                                          left: Math.min(rect.left, window.innerWidth - 192),
                                          bottom: Math.max(16, window.innerHeight - rect.top + 8),
                                        }
                                      : null
                                  );
                                  return nextId;
                                });
                              }}
                              className="absolute -left-11 top-2 flex size-8 items-center justify-center rounded-full border border-[#D8E0F3] bg-white text-[#5A6B93] shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[#11162A] dark:text-slate-200 dark:hover:bg-white/10"
                              aria-label="Message actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          ) : null}
                          <div
                            className={cn(
                              "rounded-[22px] px-4 py-3 text-sm shadow-sm",
                              mine
                                ? "bg-[#7C3AED] text-white"
                                : "bg-slate-100 text-foreground dark:bg-white/10 dark:text-slate-100"
                            )}
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editingDraft}
                                  onChange={(event) => setEditingDraft(event.target.value)}
                                  className={cn(
                                    "min-h-[84px] w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none",
                                    mine
                                      ? "border-white/30 bg-white/10 text-white placeholder:text-white/70"
                                      : "border-[#D8E0F3] bg-white text-foreground"
                                  )}
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingDraft("");
                                    }}
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs",
                                      mine ? "bg-white/15 text-white" : "bg-slate-200 text-foreground"
                                    )}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs font-medium",
                                      mine ? "bg-white text-[#7C3AED]" : "bg-[#7C3AED] text-white"
                                    )}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.text}
                                {renderAttachment(message, mine)}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "mt-1 px-1 text-[11px] text-muted-foreground",
                          mine ? "text-right" : "pl-10 text-left"
                        )}
                      >
                        {formatChatTime(message.sentAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#D8E0F3] bg-white px-3 py-3 dark:border-white/10 dark:bg-[#11162A]">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAttachmentMenuOpen((current) => !current)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D8E0F3] bg-white text-[#5A6B93] transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    aria-label="Add attachment"
                  >
                    +
                  </button>
                  {attachmentMenuOpen ? (
                    <div className="absolute bottom-12 left-0 z-10 w-44 rounded-2xl border border-[#D8E0F3] bg-white p-2 shadow-[0_16px_40px_rgba(25,40,83,0.18)] dark:border-white/10 dark:bg-[#11162A]">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        <FileImage className="size-4 text-[#7C3AED]" />
                        <span>Send image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => documentInputRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        <Paperclip className="size-4 text-[#7C3AED]" />
                        <span>Send document</span>
                      </button>
                    </div>
                  ) : null}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleAttachmentChange(event, "image")}
                  />
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => void handleAttachmentChange(event, "document")}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center rounded-full border border-[#D8E0F3] bg-white px-3 dark:border-white/10 dark:bg-white/5">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Enter message"
                    className="chat-message-input h-11 w-full border-0 bg-transparent text-sm text-foreground shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  onClick={handleSend}
                  size="icon"
                  className="shrink-0 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            No conversation selected.
          </div>
        )}
      </div>
      </div>
    </>
  );
}
