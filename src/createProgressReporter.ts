import { createTimer } from "./createTimer";

export const createProgressReporter = (
  inProgressMessage: string,
  finishedMessage: string
) => {
  let count = 0;
  let last = Date.now();
  const t = createTimer();
  return {
    tick: () => {
      count += 1;
      if (Date.now() - last > 1000) {
        last = Date.now();
        console.log(`${inProgressMessage}... Number of files so far: ${count}`);
      }
    },
    finalize() {
      console.log(`${finishedMessage} in ${t()}. Number of files: ${count}`);
    },
  };
};
