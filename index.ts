import { Command } from "commander";
import { client } from "./llm";
import { SYSTEM_PROMPT_V2 } from "./prompt";
import type { ChatMessages } from "@openrouter/sdk/models";
import { parseAgentJsonSteps } from "./parse-agent-response";
import {
  executeCommand,
  fetchWebpage,
  readFile,
  writeFile,
  listFiles,
  openInBrowser,
  createOutputDir,
} from "./utils";

const program = new Command();

program
  .name("CLI Agent")
  .description("CLI Agent to clone any website")
  .version("0.0.1");

function prompt(rl: ReturnType<typeof createRl>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function createRl() {
  const readline = require("readline");
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function runAgentLoop(
  messages: ChatMessages[],
  outputDir: string
): Promise<boolean> {
  let finished = false;

  while (!finished) {
    const response = await client.chat.send({
      chatRequest: {
        model: "openai/gpt-oss-120b:free",
        messages,
        stream: false,
        responseFormat: {
          type: "json_object",
        },
      },
    });

    const content = response?.choices[0]?.message?.content;
    const steps = parseAgentJsonSteps(content);

    if (steps.length === 0) {
      console.error("\n[Agent] Could not parse response — asking LLM to retry...");
      messages.push({
        role: "developer",
        content: JSON.stringify({
          step: "OBSERVE",
          content:
            "Your last response was not valid JSON. Please respond with exactly ONE valid JSON object matching the format: { \"step\": \"...\", \"content\": \"...\" }. Continue from where you left off.",
        }),
      });
      continue;
    }

    for (const parsedContent of steps) {
      messages.push({
        role: "assistant",
        content: JSON.stringify(parsedContent),
      });

      const step = parsedContent.step as string;

      switch (step) {
        case "START":
          console.log("\n[START] " + parsedContent.content);
          break;

        case "THINK":
          console.log("\n[THINK] " + parsedContent.content);
          break;

        case "TOOL": {
          const toolName = String(parsedContent.tool_name ?? "");
          console.log(`\n[TOOL]  → ${toolName}`);

          let toolResult: string;
          try {
            toolResult = await dispatchTool(toolName, parsedContent.tool_args, outputDir);
            console.log(`[OBSERVE] ${toolResult.slice(0, 300)}${toolResult.length > 300 ? "..." : ""}`);
          } catch (err) {
            toolResult = "Tool execution failed: " + String(err);
            console.error(`[OBSERVE] ${toolResult}`);
          }

          messages.push({
            role: "developer",
            content: JSON.stringify({ step: "OBSERVE", content: toolResult }),
          });
          break;
        }

        case "OBSERVE":
          console.log("\n[OBSERVE] " + parsedContent.content);
          break;

        case "OUTPUT":
          console.log("\n[OUTPUT] " + parsedContent.content);
          console.log("\n✅ Agent task complete.");
          finished = true;
          break;

        default:
          console.log(`[UNKNOWN STEP: ${step}] — continuing`);
          break;
      }

      if (finished) break;
    }
  }

  return finished;
}

async function dispatchTool(
  toolName: string,
  toolArgs: unknown,
  outputDir: string
): Promise<string> {
  const parseArgs = (args: unknown): Record<string, string> => {
    if (typeof args === "string") {
      try {
        return JSON.parse(args);
      } catch {
        return { _raw: args };
      }
    }
    if (typeof args === "object" && args !== null) {
      return args as Record<string, string>;
    }
    return {};
  };

  switch (toolName) {
    case "fetchWebpage": {
      const url = typeof toolArgs === "string" ? toolArgs.trim() : parseArgs(toolArgs).url ?? "";
      if (!url) throw new Error("fetchWebpage requires a URL");
      console.log(`       Fetching: ${url}`);
      return await fetchWebpage(url);
    }

    case "executeCommand": {
      const cmd = typeof toolArgs === "string" ? toolArgs : parseArgs(toolArgs)._raw ?? "";
      if (!cmd) throw new Error("executeCommand requires a command string");
      console.log(`       $ ${cmd}`);
      return await executeCommand(cmd);
    }

    case "writeFile": {
      const args = parseArgs(toolArgs);
      const filePath = resolvePath(args.path ?? "", outputDir);
      const fileContent = args.content ?? "";
      if (!filePath) throw new Error("writeFile requires a path");
      console.log(`       Writing: ${filePath} (${fileContent.length} bytes)`);
      return writeFile(filePath, fileContent);
    }

    case "readFile": {
      const args = parseArgs(toolArgs);
      const filePath = resolvePath(args.path ?? "", outputDir);
      if (!filePath) throw new Error("readFile requires a path");
      console.log(`       Reading: ${filePath}`);
      return readFile(filePath);
    }

    case "listFiles": {
      const args = parseArgs(toolArgs);
      const dir = resolvePath(args.dir ?? outputDir, outputDir);
      console.log(`       Listing: ${dir}`);
      return listFiles(dir);
    }

    case "openInBrowser": {
      const args = parseArgs(toolArgs);
      const filePath = resolvePath(args.path ?? "", outputDir);
      if (!filePath) throw new Error("openInBrowser requires a path");
      console.log(`       Opening: ${filePath}`);
      return await openInBrowser(filePath);
    }

    default:
      return `Tool "${toolName}" is not available. Available tools: fetchWebpage, executeCommand, writeFile, readFile, listFiles, openInBrowser`;
  }
}

function resolvePath(filePath: string, outputDir: string): string {
  if (!filePath) return outputDir;
  if (filePath.startsWith("/") || filePath.startsWith("~")) return filePath;
  return require("path").join(outputDir, filePath);
}

program.action(async () => {
  console.log(`
╭──────────────────────────────────────────────────────────────╮
│                 🤖  Welcome to CLI Cloner!                   │
├──────────────────────────────────────────────────────────────┤
│  Clone any website into local HTML/CSS/JS files.             │
│  Type a website URL to clone, or chat to refine the result.  │
│  Type "exit" or "quit" to stop.                              │
╰──────────────────────────────────────────────────────────────╯
`);

  const rl = createRl();

  const userInput = await prompt(rl, "Enter the website URL to clone: ");

  const trimmedInput = userInput.trim();

  if (!trimmedInput || ["exit", "quit", "q"].includes(trimmedInput.toLowerCase())) {
    console.log("Exiting. Goodbye!");
    rl.close();
    return;
  }

  let outputDir: string;
  try {
    outputDir = createOutputDir(trimmedInput);
    console.log(`\n📁 Output directory: ${outputDir}\n`);
  } catch (err) {
    console.error("Invalid URL. Please provide a full URL like https://example.com");
    rl.close();
    return;
  }

  const messages: ChatMessages[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT_V2,
    },
    {
      role: "user",
      content: `Clone this website: ${trimmedInput}\n\nSave all output files to this directory: ${outputDir}`,
    },
  ];

  await runAgentLoop(messages, outputDir);

  while (true) {
    const followUp = await prompt(
      rl,
      "\n💬 Ask for changes, or type 'exit' to quit: "
    );

    if (!followUp || ["exit", "quit", "q"].includes(followUp.trim().toLowerCase())) {
      console.log("\nGoodbye! Your clone is saved in: " + outputDir);
      break;
    }

    messages.push({
      role: "user",
      content: followUp.trim(),
    });

    await runAgentLoop(messages, outputDir);
  }

  rl.close();
});

program.parse();
