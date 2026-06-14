import { prisma } from "./db";
import { sendEmail } from "./email";
import { appUrl } from "./config";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  marketId?: string | null;
  email?: boolean;
};

export async function notify(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      marketId: input.marketId ?? null,
    },
  });

  if (input.email) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (user) {
      const link = input.marketId ? `${appUrl()}/markets/${input.marketId}` : appUrl();
      await sendEmail({
        to: user.email,
        subject: input.title,
        html: emailTemplate(input.title, input.body ?? "", link),
      });
    }
  }
}

export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}

function emailTemplate(title: string, body: string, link: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px">
    <h2 style="margin:0 0 8px;font-size:18px">${title}</h2>
    <p style="color:#444;line-height:1.5;margin:0 0 16px">${body}</p>
    <p style="margin:0">
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Hunch</a>
    </p>
  </div>`;
}
