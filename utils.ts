import { exec } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export async function executeCommand(command: string): Promise<string> {
  return new Promise((res, rej) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        rej(`Error: ${error.message}\nStderr: ${stderr}`);
        return;
      }
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      res(output || "(command completed with no output)");
    });
  });
}

export async function fetchWebpage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return html.length > 80000
      ? html.slice(0, 80000) + "\n\n[... HTML truncated at 80KB ...]"
      : html;
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${String(err)}`);
  }
}

export function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read file ${filePath}: ${String(err)}`);
  }
}

export function writeFile(filePath: string, content: string): string {
  try {
    const dir = filePath.includes("/") ? filePath.split("/").slice(0, -1).join("/") : ".";
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, content, "utf-8");
    return `File written successfully: ${filePath}`;
  } catch (err) {
    throw new Error(`Failed to write file ${filePath}: ${String(err)}`);
  }
}

export function listFiles(dirPath: string): string {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries
      .map((e) => (e.isDirectory() ? `[dir]  ${e.name}/` : `[file] ${e.name}`))
      .join("\n") || "(empty directory)";
  } catch (err) {
    throw new Error(`Failed to list files in ${dirPath}: ${String(err)}`);
  }
}

export function openInBrowser(filePath: string): Promise<string> {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${filePath}"`
      : platform === "win32"
      ? `start "" "${filePath}"`
      : `xdg-open "${filePath}"`;
  return executeCommand(cmd);
}

export function createOutputDir(url: string): string {
  const hostname = new URL(url).hostname.replace(/\./g, "-");
  const timestamp = new Date().toISOString().slice(0, 10);
  const dir = join(process.cwd(), "output", `${hostname}-${timestamp}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}
