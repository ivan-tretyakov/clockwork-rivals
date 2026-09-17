import { spawnSync } from "node:child_process";
import { readFile, readdir, mkdir, unlink } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

// Build with `npm run build:pages` first. A temporary Git index publishes only
// dist/pages, preserving main, the user's working tree, and gh-pages history.
const root = process.cwd();
const output = resolve(root, "dist/pages");
await mkdir(resolve(root, ".local"), { recursive: true });
const indexFile = resolve(root, ".local", `pages-index-${Date.now()}`);
const env = { ...process.env, GIT_INDEX_FILE: indexFile };
function git(args, input, index = false) {
  const result = spawnSync("git", args, {
    cwd: root,
    env: index ? env : process.env,
    input,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.error?.message || `git ${args[0]} failed`,
    );
  return result.stdout.trim();
}
const revision = git(["rev-parse", "--short", "HEAD"]);
const origin = git(["remote", "get-url", "origin"]);
if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(origin))
  throw new Error("Expected a GitHub HTTPS origin.");
const indexHtml = await readFile(resolve(output, "index.html"), "utf8");
if (!indexHtml.includes("/clockwork-rivals/assets/"))
  throw new Error("Build the GitHub Pages variant before publishing.");
await readFile(resolve(output, ".nojekyll"));
const remote = git(["ls-remote", "--heads", "origin", "gh-pages"]);
let parent;
if (remote) {
  git(["fetch", "origin", "gh-pages"]);
  parent = git(["rev-parse", "FETCH_HEAD"]);
}
try {
  git(["read-tree", "--empty"], undefined, true);
  async function addDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (!path.startsWith(output + sep))
        throw new Error("Unexpected artifact path.");
      if (entry.isSymbolicLink())
        throw new Error("Symlinks are not supported in Pages artifacts.");
      if (entry.isDirectory()) await addDirectory(path);
      else {
        const bytes = await readFile(path);
        const hash = git(["hash-object", "-w", "--stdin"], bytes);
        const file = relative(output, path).split(sep).join("/");
        git(
          ["update-index", "--add", "--cacheinfo", `100644,${hash},${file}`],
          undefined,
          true,
        );
      }
    }
  }
  await addDirectory(output);
  const tree = git(["write-tree"], undefined, true);
  const commit = git([
    "commit-tree",
    tree,
    ...(parent ? ["-p", parent] : []),
    "-m",
    `Publish Clockwork Rivals from ${revision}`,
  ]);
  console.log(git(["push", "origin", `${commit}:refs/heads/gh-pages`]));
  console.log(
    `Published static artifact ${commit.slice(0, 7)} from source ${revision}.`,
  );
} finally {
  await unlink(indexFile).catch(() => {});
}
