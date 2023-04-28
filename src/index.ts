#!/usr/bin/env node

import yargs from "yargs";

yargs(process.argv.slice(2))
  .demandCommand()
  .strict()
  .help()
  .command("$0", "Do thing", {}, async () => {
    console.log("Doing thing");
  })
  .parse();
