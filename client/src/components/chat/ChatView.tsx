import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasRetrievalControls } from "../../config/capabilities";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useApiVersion } from "../../hooks/useApiVersion";
import { useChat } from "../../hooks/useChat";
import { useRetrievalConfig } from "../../hooks/useRetrievalConfig";
import { useRetrievalOptions } from "../../hooks/useRetrievalOptions";
import { describeError } from "../../api/errors";
import { Notice } from "../common/Notice";
import { SearchSettings } from "../retrieval/SearchSettings";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { EmptyChat } from "./EmptyChat";

interface Props {
  conversationId?: string;
  /** Changes when the user presses "New conversation" while already on the empty route. */
  resetSignal?: number;
}

export function ChatView({ conversationId, resetSignal }: Props) {
  const navigate = useNavigate();
  const { capabilities } = useApiVersion();
  const { activeWorkspace } = useWorkspace();
  const options = useRetrievalOptions(activeWorkspace?.id);
  const { config, update, issues } = useRetrievalConfig(options.data);
  const [draft, setDraft] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = useChat({
    conversationId,
    workspaceId: activeWorkspace?.id,
    onConversationCreated: (id) => navigate(`/c/${encodeURIComponent(id)}`, { replace: true }),
  });
  const { reset } = chat;

  useEffect(() => {
    if (resetSignal !== undefined) {
      reset();
      setDraft("");
      setFocusSignal((n) => n + 1);
    }
  }, [resetSignal, reset]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.messages]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void chat.send(text, config);
  }, [draft, chat, config]);

  const pickPrompt = (p: string) => {
    setDraft(p);
    setFocusSignal((n) => n + 1);
  };

  const input = (
    <ChatInput
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      onCancel={chat.cancel}
      pending={chat.pending}
      focusSignal={focusSignal}
      blockedReason={issues[0]?.message}
      settings={
        hasRetrievalControls(capabilities) ? (
          <SearchSettings config={config} update={update} issues={issues} options={options} />
        ) : undefined
      }
    />
  );

  const showEmpty = chat.messages.length === 0 && !chat.loadingConversation && !chat.loadError;

  if (showEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-4 py-10 sm:px-8">
        <EmptyChat onPick={pickPrompt} />
        <div className="w-full max-w-2xl">{input}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-8" aria-live="polite">
          {chat.loadingConversation && <p className="pulse-soft text-sm text-muted">Loading conversation…</p>}
          {chat.loadError && <Notice tone="error">{describeError(chat.loadError)}</Notice>}
          {chat.messages.map((m) => (
            <ChatMessage key={m.id} message={m} retryDisabled={chat.pending} onRetry={(id) => chat.retry(id, config)} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-5 sm:px-8">{input}</div>
    </div>
  );
}
