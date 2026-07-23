const configuredMailMode = import.meta.env.VITE_MAIL_MODE;

if (configuredMailMode !== "attach" && configuredMailMode !== "detach") {
    throw new Error('Invalid VITE_MAIL_MODE: expected "attach" or "detach".');
}

export const mailMode = configuredMailMode;
