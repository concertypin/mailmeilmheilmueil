import PostalMime, { type Address, type Email } from "postal-mime";
import { parse as parseHtml } from "node-html-parser";
import { Timestamp } from "firebase-admin/firestore";
import type { MailItem } from "../../src/lib/mail-schema";

class MailParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MailParseError";
    }
}

function mailboxes(addresses: Address[] | undefined): string[] {
    return (addresses ?? []).flatMap((address) =>
        "address" in address && address.address ? [address.address] : []
    );
}

function sender(email: Email): { name: string; address: string } {
    if (email.from && "address" in email.from && email.from.address) {
        return { name: email.from.name, address: email.from.address };
    }
    return { name: "", address: "" };
}

function parsedMail(email: Email, receivedAt: Timestamp): Omit<MailItem, "id"> {
    const from = sender(email);
    const recipients = [...mailboxes(email.to), ...mailboxes(email.cc)];
    return {
        senderName: from.name,
        senderAddress: from.address,
        recipients: [...new Set(recipients)],
        subject: email.subject?.trim() ?? "(제목 없음)",
        textBody: email.text?.trim() ?? "",
        htmlBody: email.html?.trim() || undefined,
        receivedAt,
        externalMessageId: email.messageId ?? null,
        status: "queued",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
        draft: null,
    };
}
async function parseEmail(raw: Buffer): Promise<Email> {
    try {
        return await PostalMime.parse(raw);
    } catch {
        throw new MailParseError("Unparseable RFC 822 message");
    }
}

function requireTextBody(email: Email): void {
    if (!email.text?.trim() && email.html?.trim()) {
        email.text = parseHtml(email.html).text;
    }
    if (!email.text?.trim()) {
        throw new MailParseError("Message has no usable text body");
    }
}

export async function parseMailSource(
    raw: Buffer,
    receivedAt = Timestamp.now()
): Promise<Omit<MailItem, "id">> {
    const email = await parseEmail(raw);
    requireTextBody(email);
    return parsedMail(email, receivedAt);
}
