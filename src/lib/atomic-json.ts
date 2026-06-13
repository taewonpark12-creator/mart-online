import { open, rename, rm } from "fs/promises";
import path from "path";

export async function atomicWriteJsonFile(filePath: string, data: unknown) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const payload = `${JSON.stringify(data)}\n`;
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    handle = await open(temporaryPath, "w");
    await handle.writeFile(payload, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
