import { useLocation, useParams } from "react-router-dom";
import { ChatView } from "../components/chat/ChatView";

export function ChatPage() {
  const { conversationId } = useParams();
  const location = useLocation();
  const fresh = (location.state as { fresh?: number } | null)?.fresh;
  return <ChatView conversationId={conversationId} resetSignal={fresh} />;
}
