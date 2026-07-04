"use client";

export type EmployeeChatParticipant = {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: "online" | "away" | "offline";
};

export type EmployeeChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
  read: boolean;
  pinned?: boolean;
  attachment?: {
    kind: "image" | "document";
    name: string;
    mimeType: string;
    url: string;
    sizeLabel: string;
  };
};

export type EmployeeChatConversation = {
  id: string;
  participant: EmployeeChatParticipant;
  topic: string;
  messages: EmployeeChatMessage[];
};

const STORAGE_PREFIX = "hris.employee.chat.v1";

function storageKey(employeeId: string) {
  return `${STORAGE_PREFIX}.${employeeId}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function newId(prefix: string) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function isoMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function seedConversations(input: {
  employeeId: string;
  employeeName: string;
  managerName?: string;
}): EmployeeChatConversation[] {
  return [
    {
      id: "conv-hr",
      participant: {
        id: "hr-support",
        name: "HR Support",
        role: "HR Operations",
        avatarColor: "bg-rose-100 text-rose-700",
        status: "online",
      },
      topic: "Exit requirements",
      messages: [
        {
          id: "msg-hr-1",
          senderId: "hr-support",
          senderName: "HR Support",
          text: "Hello! We opened this thread so you can ask questions about your offboarding requirements and timelines.",
          sentAt: isoMinutesAgo(95),
          read: true,
        },
        {
          id: "msg-hr-2",
          senderId: "hr-support",
          senderName: "HR Support",
          text: "Please complete your exit interview and required acknowledgements before your effective separation date.",
          sentAt: isoMinutesAgo(32),
          read: false,
        },
      ],
    },
    {
      id: "conv-manager",
      participant: {
        id: "manager",
        name: input.managerName || "Michael Scott",
        role: "Reporting Manager",
        avatarColor: "bg-sky-100 text-sky-700",
        status: "away",
      },
      topic: "Handover progress",
      messages: [
        {
          id: "msg-mgr-1",
          senderId: "manager",
          senderName: input.managerName || "Michael Scott",
          text: "Use this chat to confirm handover progress and let me know if any work items need clarification.",
          sentAt: isoMinutesAgo(210),
          read: true,
        },
        {
          id: "msg-mgr-2",
          senderId: input.employeeId,
          senderName: input.employeeName,
          text: "I’m updating the handover tracker today and will send the final project notes after lunch.",
          sentAt: isoMinutesAgo(140),
          read: true,
        },
      ],
    },
    {
      id: "conv-admin",
      participant: {
        id: "system-admin",
        name: "System Admin",
        role: "IT Support",
        avatarColor: "bg-amber-100 text-amber-700",
        status: "online",
      },
      topic: "Access and device return",
      messages: [
        {
          id: "msg-it-1",
          senderId: "system-admin",
          senderName: "System Admin",
          text: "We’ll coordinate system access removal and device return here. Let us know once your laptop and access card are ready for handoff.",
          sentAt: isoMinutesAgo(70),
          read: false,
        },
      ],
    },
  ];
}

function buildDefaultConversationMap(input: {
  employeeId: string;
  employeeName: string;
  managerName?: string;
}) {
  return new Map(
    seedConversations(input).map((conversation) => [
      conversation.participant.name.toLowerCase(),
      conversation,
    ])
  );
}

export function loadEmployeeChatConversations(input: {
  employeeId: string;
  employeeName: string;
  managerName?: string;
}) {
  if (typeof window === "undefined") return seedConversations(input);
  const parsed = safeParse<EmployeeChatConversation[]>(window.localStorage.getItem(storageKey(input.employeeId)));
  if (parsed?.length) return parsed;
  const seeded = seedConversations(input);
  window.localStorage.setItem(storageKey(input.employeeId), JSON.stringify(seeded));
  return seeded;
}

export function ensureEmployeeChatConversation(input: {
  conversations: EmployeeChatConversation[];
  employeeId: string;
  employeeName: string;
  managerName?: string;
  participantName?: string | null;
}) {
  if (!input.participantName) return input.conversations;
  const targetName = input.participantName.toLowerCase();
  const alreadyExists = input.conversations.some(
    (conversation) => conversation.participant.name.toLowerCase() === targetName
  );
  if (alreadyExists) return input.conversations;

  const defaults = buildDefaultConversationMap({
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    managerName: input.managerName,
  });
  const restoredConversation = defaults.get(targetName);
  if (!restoredConversation) return input.conversations;
  return [restoredConversation, ...input.conversations];
}

export function saveEmployeeChatConversations(employeeId: string, conversations: EmployeeChatConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(employeeId), JSON.stringify(conversations));
}

export function getEmployeeChatUnreadCount(conversations: EmployeeChatConversation[], employeeId: string) {
  return conversations.reduce(
    (total, conversation) =>
      total +
      conversation.messages.filter((message) => message.senderId !== employeeId && !message.read).length,
    0
  );
}

export function markEmployeeConversationAsRead(
  conversations: EmployeeChatConversation[],
  employeeId: string,
  conversationId: string
) {
  return conversations.map((conversation) =>
    conversation.id !== conversationId
      ? conversation
      : {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.senderId === employeeId || message.read ? message : { ...message, read: true }
          ),
        }
  );
}

export function sendEmployeeChatMessage(input: {
  conversations: EmployeeChatConversation[];
  conversationId: string;
  employeeId: string;
  employeeName: string;
  text: string;
}) {
  const trimmed = input.text.trim();
  if (!trimmed) return input.conversations;
  return input.conversations.map((conversation) =>
    conversation.id !== input.conversationId
      ? conversation
      : {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              id: newId("msg"),
              senderId: input.employeeId,
              senderName: input.employeeName,
              text: trimmed,
              sentAt: new Date().toISOString(),
              read: true,
            },
          ],
        }
  );
}

export function sendEmployeeChatAttachment(input: {
  conversations: EmployeeChatConversation[];
  conversationId: string;
  employeeId: string;
  employeeName: string;
  attachment: EmployeeChatMessage["attachment"];
}) {
  if (!input.attachment) return input.conversations;
  return input.conversations.map((conversation) =>
    conversation.id !== input.conversationId
      ? conversation
      : {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              id: newId("msg"),
              senderId: input.employeeId,
              senderName: input.employeeName,
              text:
              input.attachment?.kind === "image"
                ? "Sent an image"
                : "Sent a document",
              sentAt: new Date().toISOString(),
              read: true,
              attachment: input.attachment,
            },
          ],
        }
  );
}

export function editEmployeeChatMessage(input: {
  conversations: EmployeeChatConversation[];
  conversationId: string;
  messageId: string;
  text: string;
}) {
  const trimmed = input.text.trim();
  if (!trimmed) return input.conversations;
  return input.conversations.map((conversation) =>
    conversation.id !== input.conversationId
      ? conversation
      : {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id !== input.messageId ? message : { ...message, text: trimmed }
          ),
        }
  );
}

export function deleteEmployeeChatMessage(input: {
  conversations: EmployeeChatConversation[];
  conversationId: string;
  messageId: string;
}) {
  return input.conversations.map((conversation) =>
    conversation.id !== input.conversationId
      ? conversation
      : {
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== input.messageId),
        }
  );
}

export function forwardEmployeeChatMessage(input: {
  conversations: EmployeeChatConversation[];
  sourceConversationId: string;
  targetConversationId: string;
  messageId: string;
  employeeId: string;
  employeeName: string;
}) {
  const sourceConversation = input.conversations.find(
    (conversation) => conversation.id === input.sourceConversationId
  );
  const sourceMessage = sourceConversation?.messages.find((message) => message.id === input.messageId);
  if (!sourceMessage) return input.conversations;

  return input.conversations.map((conversation) =>
    conversation.id !== input.targetConversationId
      ? conversation
      : {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              ...sourceMessage,
              id: newId("msg"),
              senderId: input.employeeId,
              senderName: input.employeeName,
              sentAt: new Date().toISOString(),
              read: true,
            },
          ],
        }
  );
}

export function toggleEmployeeChatMessagePin(input: {
  conversations: EmployeeChatConversation[];
  conversationId: string;
  messageId: string;
}) {
  return input.conversations.map((conversation) =>
    conversation.id !== input.conversationId
      ? conversation
      : {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === input.messageId
              ? { ...message, pinned: !message.pinned }
              : { ...message, pinned: false }
          ),
        }
  );
}
