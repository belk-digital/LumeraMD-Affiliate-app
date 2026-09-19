import { sendEmail } from "@/lib/email/send";

export async function sendMagicLinkEmail(email: string, link: string) {
  await sendEmail(
    email,
    "Your admin login link",
    `<p>Click below to log in to the LumeraMD affiliate admin panel:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
  );
}
