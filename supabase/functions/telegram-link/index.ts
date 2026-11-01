// Connects the signed-in user's account to Argos on Telegram.
// action "start": a one-time code and the t.me link that carries it. action "status": whether a chat is linked,
// and the latest Telegram messages. action "unlink": disconnects every chat of this user.
import { adminClient, json, requireUser, serve } from "../_shared/runtime.ts";

const BOT_NAME = Deno.env.get("TELEGRAM_BOT_NAME") || "odysstay_bot";

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const action = String(body["action"] ?? "status");

  if (action === "start") {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    await admin.from("telegram_links").delete().eq("user_id", user.id);
    await admin.from("telegram_links").insert({ code, user_id: user.id });
    return json({ url: `https://t.me/${BOT_NAME}?start=link_${code}` });
  }
  if (action === "unlink") {
    await admin.from("telegram_chats").update({ user_id: null }).eq("user_id", user.id);
    return json({ connected: false });
  }
  const { data: chat } = await admin.from("telegram_chats").select("username, updated_at").eq("user_id", user.id)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  let recent: { role: string; content: string; created_at: string }[] = [];
  if (chat) {
    const { data: conv } = await admin.from("agent_conversations").select("id").eq("user_id", user.id).eq("channel", "telegram")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (conv) {
      const { data } = await admin.from("agent_messages").select("role, content, created_at").eq("conversation_id", conv.id)
        .order("created_at", { ascending: false }).limit(10);
      recent = (data ?? []).reverse();
    }
  }
  return json({ connected: !!chat, username: chat?.username ?? null, recent });
});
