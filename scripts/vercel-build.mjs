import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

function bin(command) {
  return isWindows ? `${command}.cmd` : command;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = isWindows
      ? spawn(`${bin(command)} ${args.join(" ")}`, {
          stdio: "inherit",
          shell: true,
          env: process.env,
        })
      : spawn(bin(command), args, {
          stdio: "inherit",
          shell: false,
          env: process.env,
        });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      }
    });
  });
}

await run("prisma", ["generate"]);

if (isVercel && hasDatabaseUrl) {
  console.log("[build] Vercel DATABASE_URL detected; running prisma migrate deploy.");
  await run("prisma", ["migrate", "deploy"]);
} else {
  console.log(
    `[build] Skipping prisma migrate deploy. isVercel=${isVercel}, hasDatabaseUrl=${hasDatabaseUrl}`,
  );
}

await run("next", ["build"]);
