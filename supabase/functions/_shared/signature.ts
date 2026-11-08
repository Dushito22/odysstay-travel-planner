// How Argos signs every email to a seller. The model writes the message; this adds the same
// signature every time, with the one-line AI disclosure the EU AI Act asks for (Art. 50, from 2 Aug 2026)
// kept quiet at the bottom instead of opening the email with it.

const AGENT = (Deno.env.get("AGENT_NAME_IT") || "Argo").trim();
const PHONE = (Deno.env.get("OFFICE_PHONE") || "").trim();

export function signature(buyer: string) {
  const who = buyer.trim() || "un nostro cliente";
  const it = [
    "Cordiali saluti,",
    "",
    AGENT,
    `Assistente di ${who}`,
    `Odysstay · odysstay.xyz${PHONE ? ` · Tel. ${PHONE}` : ""}`,
    "",
    `${AGENT} è un assistente digitale che segue la ricerca per conto di ${who}. Le decisioni le prende ${who} in persona.`,
  ].join("\n");
  const en = [
    "Kind regards,",
    "",
    AGENT,
    `Assistant to ${who}`,
    `Odysstay · odysstay.xyz${PHONE ? ` · Tel. ${PHONE}` : ""}`,
    "",
    `${AGENT} is a digital assistant handling the search for ${who}. ${who} makes the decisions in person.`,
  ].join("\n");
  return { it, en };
}

/** Long dashes read as machine-written: swap them for commas, and drop any sign-off the model added. */
export function tidy(body: string) {
  return body
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\n+(Cordiali saluti|Distinti saluti|Kind regards|Best regards|Un cordiale saluto)[\s\S]*$/i, "")
    .trim();
}

export const STYLE = `Writing style: write like a capable, friendly Italian professional, not a template. Open with "Buongiorno," (or "Gentile <name>," when you know the name). Short paragraphs, plain sentences, formal Lei, warm but not gushing. No long dashes (— or –), no bullet lists unless listing documents, no exclamation marks, no clichés like "Spero che questa email La trovi bene". Do not open by saying you are an AI and do not add a sign-off or signature: the system appends the signature, which already says who you are.`;
