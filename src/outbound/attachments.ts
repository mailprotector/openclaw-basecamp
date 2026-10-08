/**
 * Local files an agent tool may attach to a Basecamp post.
 *
 * Attaching reads a file on the gateway host and uploads it to Basecamp, so an agent that can name
 * any path could post host secrets. Only files under the directories listed (colon-separated,
 * absolute) in OPENCLAW_BASECAMP_ATTACHMENT_ROOTS can be attached; with none listed, attachments
 * are refused. Paths are resolved through symlinks before the check.
 */

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { BasecampClient } from "../basecamp-client.js";
import { mediaNameAndType } from "./media-types.js";

/** Same cap as the outbound media send's default. */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export function attachmentRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.OPENCLAW_BASECAMP_ATTACHMENT_ROOTS ?? "")
    .split(":")
    .map((r) => r.trim())
    .filter((r) => path.isAbsolute(r));
}

/** Read an allowed file; throws with a reason the agent can act on. */
export async function readAllowedAttachment(
  filePath: string,
  roots: string[] = attachmentRoots(),
): Promise<{ data: Buffer; name: string; contentType: string }> {
  if (roots.length === 0) {
    throw new Error("Attachments are disabled on this gateway (OPENCLAW_BASECAMP_ATTACHMENT_ROOTS is not set)");
  }
  let real: string;
  try {
    real = await realpath(filePath);
  } catch {
    throw new Error(`Attachment not found: ${filePath}`);
  }
  const allowed = await Promise.all(roots.map((r) => realpath(r).catch(() => undefined)));
  if (!allowed.some((r) => r !== undefined && real.startsWith(r + path.sep))) {
    throw new Error(`Attachment ${filePath} is outside the allowed attachment directories (${roots.join(", ")})`);
  }
  const info = await stat(real);
  if (!info.isFile()) throw new Error(`Attachment ${filePath} is not a file`);
  if (info.size > ATTACHMENT_MAX_BYTES) {
    throw new Error(`Attachment ${filePath} exceeds the ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB limit`);
  }
  const { name, contentType } = mediaNameAndType(real);
  return { data: await readFile(real), name, contentType };
}

/** Upload allowed files and return the bc-attachment tags that embed them in rich text. */
export async function uploadAttachments(client: BasecampClient, filePaths: string[]): Promise<string[]> {
  const files = await Promise.all(filePaths.map((p) => readAllowedAttachment(p)));
  const tags: string[] = [];
  for (const file of files) {
    const uploaded = await client.attachments.create(new Uint8Array(file.data), file.contentType, file.name);
    const sgid = uploaded?.attachable_sgid;
    if (!sgid) throw new Error(`Basecamp attachment upload for "${file.name}" returned no attachable_sgid`);
    const name = file.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    tags.push(`<bc-attachment sgid="${sgid}" content-type="${file.contentType}" filename="${name}"></bc-attachment>`);
  }
  return tags;
}
