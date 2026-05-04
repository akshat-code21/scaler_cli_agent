import { Command } from "commander";

const program = new Command();

program
  .name("CLI Agent")
  .description("CLI Agent to clone websites")
  .version("0.0.1");

program.action(() => {
  console.log(`
╭──────────────────────────────────────────────────────────────╮
│                 🤖  Welcome to CLI Cloner!                   │
├──────────────────────────────────────────────────────────────┤
│      This tool lets you clone and clone websites.            │
│                                                              │
│        Type '--help' to see available commands & flags.      │
╰──────────────────────────────────────────────────────────────╯
`);

  const readline = require("readline");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    "Please enter the website link to clone: ",
    (websiteLink: string) => {
      console.log(`Received link: ${websiteLink}`);

      rl.close();
    },
  );
});

program.parse();
