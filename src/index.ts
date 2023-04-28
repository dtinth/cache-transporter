#!/usr/bin/env node

import yargs from "yargs";

yargs(process.argv.slice(2))
  .demandCommand()
  .strict()
  .help()
  .command("$0", "push", {}, async () => {
    console.log("push");
  })
  .command("$0", "pull", {}, async () => {
    console.log("pull");
  })
  .command("$0", "server", {}, async () => {
    console.log("server");
  })
  .parse();
