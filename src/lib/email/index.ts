/** Placeholder for transactional email (Resend, SES, etc.). */
export async function sendEmail(_args: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  /* no-op in demo app */
}
