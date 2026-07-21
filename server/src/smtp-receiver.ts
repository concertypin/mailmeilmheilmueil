import {
    SMTPServer,
    type SMTPServerDataStream,
    type SMTPServerEnvelope,
} from "smtp-server";
import PostalMime, { type Address, type Email } from "postal-mime";
import { parse as parseHtml } from "node-html-parser";
import { Timestamp } from "firebase-admin/firestore";
import {
    queuedMail,
    firestoreRepository,
    type MailRepository,
} from "./repository";
import { processMailItem } from "./processor";
import type { MailItem } from "../../src/lib/mail-schema";

const MAX_MESSAGE_SIZE = 1024 * 1024;

class SmtpDataError extends Error {
    constructor(
        message: string,
        readonly responseCode: number
    ) {
        super(message);
        this.name = "SmtpDataError";
    }
}

function mailboxes(addresses: Address[] | undefined): string[] {
    return (addresses ?? []).flatMap((address) =>
        "address" in address && address.address ? [address.address] : []
    );
}

function sender(
    email: Email,
    envelope?: SMTPServerEnvelope
): { name: string; address: string } {
    if (email.from && "address" in email.from && email.from.address) {
        return { name: email.from.name, address: email.from.address };
    }
    return {
        name: "",
        address:
            envelope && envelope.mailFrom !== false
                ? envelope.mailFrom.address
                : "",
    };
}

function parsedMail(
    email: Email,
    receivedAt: Timestamp,
    envelope?: SMTPServerEnvelope
): Omit<MailItem, "id"> {
    const from = sender(email, envelope);
    const recipients = [
        ...mailboxes(email.to),
        ...mailboxes(email.cc),
        ...(envelope?.rcptTo.map((recipient) => recipient.address) ?? []),
    ];
    return queuedMail({
        senderName: from.name,
        senderAddress: from.address,
        recipients: [...new Set(recipients)],
        subject: email.subject?.trim() ?? "(제목 없음)",
        textBody: email.text?.trim() ?? "",
        receivedAt,
        externalMessageId: email.messageId ?? null,
        status: "queued",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
    });
}

async function parseEmail(raw: Buffer): Promise<Email> {
    try {
        return await PostalMime.parse(raw);
    } catch {
        throw new SmtpDataError("Unparseable RFC 822 message", 554);
    }
}

function requireTextBody(email: Email): void {
    if (!email.text?.trim() && email.html?.trim()) {
        email.text = parseHtml(email.html).text;
    }
    if (!email.text?.trim()) {
        throw new SmtpDataError("Message has no usable text body", 554);
    }
}

export async function parseMailMessage(
    raw: Buffer,
    envelope: SMTPServerEnvelope,
    receivedAt = Timestamp.now()
): Promise<Omit<MailItem, "id">> {
    const email = await parseEmail(raw);
    requireTextBody(email);
    return parsedMail(email, receivedAt, envelope);
}

export async function parseMailSource(
    raw: Buffer,
    receivedAt = Timestamp.now()
): Promise<Omit<MailItem, "id">> {
    const email = await parseEmail(raw);
    requireTextBody(email);
    return parsedMail(email, receivedAt);
}

export async function persistParsedMail(
    raw: Buffer,
    envelope: SMTPServerEnvelope,
    repository: MailRepository
): Promise<string> {
    return repository.create(await parseMailMessage(raw, envelope));
}

async function readStream(stream: SMTPServerDataStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        const chunkValue: unknown = chunk;
        if (typeof chunkValue === "string") {
            chunks.push(Buffer.from(chunkValue));
        } else if (Buffer.isBuffer(chunkValue)) {
            chunks.push(chunkValue);
        }
    }
    return Buffer.concat(chunks);
}

async function handleData(
    stream: SMTPServerDataStream,
    envelope: SMTPServerEnvelope,
    repository: MailRepository,
    callback: (err?: Error | null, message?: string) => void
): Promise<void> {
    try {
        const raw = await readStream(stream);
        if (stream.sizeExceeded || raw.byteLength > MAX_MESSAGE_SIZE) {
            throw new SmtpDataError("Message exceeds the 1 MiB limit", 552);
        }
        const id = await persistParsedMail(raw, envelope, repository);
        callback(null, "Message accepted");
        void processMailItem(id, repository).catch((error: unknown) =>
            process.stderr.write(`Mail processing failed: ${String(error)}\n`)
        );
    } catch (error: unknown) {
        if (error instanceof SmtpDataError) {
            callback(error);
        } else {
            process.stderr.write(
                `SMTP message handling failed: ${String(error)}\n`
            );
            callback(new SmtpDataError("Message rejected", 554));
        }
    }
}

/** Start the loopback-only SMTP listener used by the deterministic demo mail script. */
export function startTestSmtpServer(
    repository: MailRepository = firestoreRepository,
    port = Number(process.env.SMTP_PORT ?? 2525)
): SMTPServer {
    const server = new SMTPServer({
        authOptional: true,
        disabledCommands: ["AUTH", "STARTTLS"],
        size: MAX_MESSAGE_SIZE,
        onData: (stream, session, callback) => {
            void handleData(stream, session.envelope, repository, callback);
        },
    });
    server.listen(port, "127.0.0.1", () =>
        process.stdout.write(
            `SMTP test server listening on 127.0.0.1:${port}\n`
        )
    );
    return server;
}
