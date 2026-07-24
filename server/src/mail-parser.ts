import PostalMime, { type Address, type Email } from "postal-mime";
import { parse as parseHtml } from "node-html-parser";
import { Timestamp } from "firebase-admin/firestore";
import type { MailItem } from "../../src/lib/mail-schema";

export type MailImage = {
    readonly data: Uint8Array;
    readonly mediaType: string;
};

export type ParsedMailSource = {
    readonly item: Omit<MailItem, "id">;
    readonly images: readonly MailImage[];
};

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

/** Normalize text body from HTML when plain text absent. */
function normalizeBody(email: Email): void {
    if (!email.text?.trim() && email.html?.trim()) {
        email.text = parseHtml(email.html).text;
    }
}

function extractImages(email: Email): MailImage[] {
    const images: MailImage[] = [];
    for (const attachment of email.attachments ?? []) {
        const mimeType = attachment.mimeType;
        if (!mimeType.startsWith("image/")) continue;
        const content = attachment.content;
        if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            const data =
                content instanceof Uint8Array
                    ? content
                    : new Uint8Array(content);
            images.push({ data, mediaType: mimeType });
        }
    }
    return images;
}

export async function parseMailSource(
    raw: Buffer,
    receivedAt = Timestamp.now()
): Promise<ParsedMailSource> {
    const email = await parseEmail(raw);
    normalizeBody(email);
    const images = extractImages(email);
    if (!email.text?.trim() && images.length === 0) {
        throw new MailParseError(
            "Message has no usable text body or image attachment"
        );
    }
    const item = parsedMail(email, receivedAt);
    return { item, images };
}
