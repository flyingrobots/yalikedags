import { resolve } from "node:path";
import { OfflinePackage } from "./offline/OfflinePackage.ts";

const output = resolve(process.argv[2] ?? `dist/offline-${process.platform}-${process.arch}`);
const license = process.argv[3];
if (license === undefined) { throw new Error("usage: bun run package:offline <new-output-directory> <Bun-distribution-LICENSE.md>"); }
await new OfflinePackage(resolve(import.meta.dir, "..")).build(output, resolve(license));
console.log(`Offline distribution written to ${output}`);
