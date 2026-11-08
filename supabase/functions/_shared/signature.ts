// How Argo signs every email to a seller. The model writes the message; this adds the same signature
// every time. "Assistente AI" in the title is the disclosure the EU AI Act asks for (Art. 50, from
// 2 Aug 2026): plain and short, the way a job title reads, instead of a paragraph that sounds defensive.

const AGENT = (Deno.env.get("AGENT_NAME_IT") || "Argo O.").trim();
const PHONE = (Deno.env.get("OFFICE_PHONE") || "").trim();

export function signature(buyer: string) {
  const who = buyer.trim();
  const role = who ? `Assistente AI di ${who}` : "Assistente AI, Odysstay";
  const roleEn = who ? `AI assistant to ${who}` : "AI assistant, Odysstay";
  const line = `Odysstay · odysstay.xyz${PHONE ? ` · ${PHONE}` : ""}`;
  return {
    it: ["Cordiali saluti,", "", AGENT, role, line].join("\n"),
    en: ["Kind regards,", "", AGENT, roleEn, line].join("\n"),
  };
}

/** Long dashes read as machine-written: swap them for commas, and drop any sign-off the model added. */
export function tidy(body: string) {
  return body
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\n+(Cordiali saluti|Distinti saluti|Kind regards|Best regards|Un cordiale saluto)[\s\S]*$/i, "")
    .trim();
}

export const STYLE = `Writing style: write like a capable, friendly Italian professional, not a template. Greeting: if CONTACT is a named person, address them by name ("Gentile Sig. Rossi," or "Gentile Sig.ra Bianchi," when you can tell, otherwise "Gentile Mario Rossi,"). If it's an agency, an office or a role with no person's name, open with "Buongiorno,". Short paragraphs, plain sentences, formal Lei, warm but not gushing. No long dashes (— or –), no bullet lists unless listing documents, no exclamation marks, no clichés like "Spero che questa email La trovi bene". Do not open by saying you are an AI and do not add a sign-off or signature: the system appends the signature, which already says who you are.`;
