import type { Plugin } from "@opencode-ai/plugin";

const AMEM_COMMAND = ". ~/.config/yuiclaw/.env && amem agent && amem owner";

export const AmemPlugin: Plugin = async ({ $ }) => {
  const injected = new Set<string>();
  const memory = await $`bash -lc ${AMEM_COMMAND}`.text().then(
    (text) => text.trim(),
    () => "",
  );

  return {
    "experimental.chat.system.transform": async (input, output) => {
      if (!memory) return;
      if (!input.sessionID) return;
      if (injected.has(input.sessionID)) return;
      injected.add(input.sessionID);

      output.system.push(memory);
    },
  };
};
