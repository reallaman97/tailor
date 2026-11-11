import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";

// Talking to Gmail with an app password: IMAP to read (never marks anything
// read or moves it), SMTP to send replies. No Google Cloud project needed.

export type MailCredentials = { email: string; appPassword: string };

export type FetchedEmail = {
  uid: number;
  messageId: string;
  references: string | null;
  fromAddress: string;
  fromName: string | null;
  replyTo: string | null;
  subject: string;
  receivedAt: Date;
  text: string;
};

export class MailboxAuthError extends Error {}

/** On the first check, look this far back. */
const FIRST_CHECK_DAYS = 14;
/** Don't download more than this of one message (attachments are skipped anyway). */
const MAX_SOURCE_BYTES = 300_000;

function imapClient(creds: MailCredentials): ImapFlow {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword.replace(/\s+/g, "") },
    logger: false,
    socketTimeout: 60_000,
  });
}

function friendlyImapError(err: unknown): Error {
  const e = err as { authenticationFailed?: boolean; responseText?: string; message?: string };
  if (e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Application-specific password/i.test(`${e?.responseText} ${e?.message}`)) {
    return new MailboxAuthError(
      "Gmail rejected the login. Check the address and app password (Google Account → Security → 2-Step Verification → App passwords), and that IMAP is enabled in Gmail settings."
    );
  }
  return new Error(`Couldn't read the mailbox: ${e?.message ?? "unknown error"}`);
}

/** Logs in and out — to validate credentials when connecting a mailbox. */
export async function testMailbox(creds: MailCredentials): Promise<void> {
  const client = imapClient(creds);
  try {
    await client.connect();
    await client.logout();
  } catch (err) {
    throw friendlyImapError(err);
  }
}

function firstAddress(a: AddressObject | AddressObject[] | undefined): { address: string; name: string | null } | null {
  const list = Array.isArray(a) ? a : a ? [a] : [];
  for (const group of list) {
    const v = group.value.find((x) => x.address);
    if (v?.address) return { address: v.address.toLowerCase(), name: v.name?.trim() || null };
  }
  return null;
}

/**
 * Fetches INBOX messages newer than `lastUid` (oldest first), at most `limit`
 * per call. Returns the new position and how many are still waiting. A
 * changed uidValidity (mailbox rebuilt) restarts from the last two weeks.
 */
export async function fetchNewEmails(
  creds: MailCredentials,
  position: { uidValidity: string | null; lastUid: number },
  limit: number
): Promise<{ emails: FetchedEmail[]; uidValidity: string; lastUid: number; remaining: number }> {
  const client = imapClient(creds);
  try {
    await client.connect();
  } catch (err) {
    throw friendlyImapError(err);
  }
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const uidValidity = mailbox ? String(mailbox.uidValidity) : "";
      const fresh = position.uidValidity !== uidValidity || position.lastUid === 0;
      const found = fresh
        ? await client.search({ since: new Date(Date.now() - FIRST_CHECK_DAYS * 86_400_000) }, { uid: true })
        : await client.search({ uid: `${position.lastUid + 1}:*` }, { uid: true });
      const after = fresh ? 0 : position.lastUid;
      const uids = (found || []).filter((u) => u > after).sort((a, b) => a - b);
      const batch = uids.slice(0, limit);

      const emails: FetchedEmail[] = [];
      if (batch.length > 0) {
        const messages = await client.fetchAll(
          batch.join(","),
          { uid: true, internalDate: true, source: { start: 0, maxLength: MAX_SOURCE_BYTES } },
          { uid: true }
        );
        for (const m of messages) {
          if (!m.source) continue;
          const parsed = await simpleParser(m.source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true });
          const from = firstAddress(parsed.from);
          if (!from) continue;
          const replyTo = firstAddress(parsed.replyTo);
          const refs = Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references ?? null);
          emails.push({
            uid: m.uid,
            messageId: parsed.messageId ?? `<uid-${uidValidity}-${m.uid}@local>`,
            references: refs,
            fromAddress: from.address,
            fromName: from.name,
            replyTo: replyTo && replyTo.address !== from.address ? replyTo.address : null,
            subject: (parsed.subject ?? "(no subject)").slice(0, 500),
            receivedAt: parsed.date ?? (m.internalDate ? new Date(m.internalDate) : new Date()),
            text: (parsed.text ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
          });
        }
      }
      const lastUid = batch.length ? batch[batch.length - 1] : fresh ? (uids.length ? uids[uids.length - 1] : (mailbox ? mailbox.uidNext - 1 : 0)) : position.lastUid;
      return { emails, uidValidity, lastUid, remaining: uids.length - batch.length };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Sends a reply from the profile's Gmail, threaded under the original message. */
export async function sendReply(
  creds: MailCredentials,
  reply: {
    fromName: string;
    to: string;
    subject: string;
    inReplyTo: string;
    references: string | null;
    text: string;
    attachment?: { filename: string; content: Buffer } | null;
  }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword.replace(/\s+/g, "") },
  });
  try {
    await transport.sendMail({
      from: { name: reply.fromName, address: creds.email },
      to: reply.to,
      subject: /^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject}`,
      inReplyTo: reply.inReplyTo,
      references: [reply.references, reply.inReplyTo].filter(Boolean).join(" "),
      text: reply.text,
      attachments: reply.attachment
        ? [
            {
              filename: reply.attachment.filename,
              content: reply.attachment.content,
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          ]
        : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    if (/Invalid login|535|Username and Password not accepted/i.test(msg)) {
      throw new MailboxAuthError("Gmail rejected the login while sending — reconnect the mailbox with a new app password.");
    }
    throw new Error(`Couldn't send the reply: ${msg}`);
  } finally {
    transport.close();
  }
}
