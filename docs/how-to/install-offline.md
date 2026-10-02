# Install an offline distribution

Use a platform-specific release directory to run local task-list, DAG, and snapshot workflows on a disconnected machine. The compiled executable contains the Bun runtime and viewer assets; the destination needs no Bun, Node, npm, package installation, or CDN. Open exported HTML with a local browser.

## Build on the preparation machine

Use the repository's frozen lockfile and the Bun version selected for your release. The build requires installed dependencies, Git, tar, and the complete `LICENSE.md` from that Bun distribution, including its runtime notices. It builds for the current OS/architecture; do not assume the resulting executable works on another platform. A connected preparation machine may be needed to obtain the toolchain and packages.

```bash
bun install --frozen-lockfile
bun run package:offline dist/offline-release /path/to/bun/LICENSE.md
bun run verify:offline dist/offline-release
```

Replace the license path with the file accompanying your installed Bun distribution. The Bun-only compiler replaces the vault dependency’s optional Deno prompt import with an explicit unsupported-runtime stub; Bun’s normal prompt path remains bundled. No Deno package is needed at runtime.

The packager refuses missing notices, dependency versions absent from the lockfile, and an existing output directory. Stage intended source files before packaging so the source archive includes them. `manifest.json` records version, platform, architecture, Bun version, source revision, dirty-tree status, lock fingerprint, and production package versions. `source.tar.gz` contains the tracked working-tree source used for the build, including staged additions. Release from a clean committed checkout for traceable builds.

Dependency notices preserve shipped license files and the package manifest's license declaration. When an upstream package supplies a declaration without a standalone license file, the notices also include its shipped README files. URL-only declarations remain URLs; packaging does not fetch or invent additional license terms. A dependency with neither a license file nor a nonempty declaration is refused.

The verification command checks payload hashes, runs JSON and HTML exports with no runtime commands in PATH, and exercises the HTML viewer with browser networking disabled. It requires the development Chromium installation on the preparation machine. This is an artifact smoke test, not proof of OS-level isolation or byte-identical compiler output.

## Transfer and verify

Transfer the entire directory using your approved offline transfer process. It includes the executable, example, source archive, lockfile, manifest, project license, dependency notices, Bun/runtime notices, and checksums.

On macOS verify from inside the copied directory:

```bash
shasum -a 256 -c SHA256SUMS
```

On Linux:

```bash
sha256sum -c SHA256SUMS
```

Checksums detect corruption, not publisher identity. Obtain the checksum list or its signature through your trusted release channel; this workflow does not claim to sign releases. Retain the included notices and source archive when redistributing the payload. Consult the runtime notices for its component requirements.

## Run without installation

```bash
./yalikedags render --tasklist example-tasklist.txt --format html --out example.html
./yalikedags serve --tasklist example-tasklist.txt --port 8787
```

Open `example.html` directly, or open the loopback address printed by `serve`. Local source files are refreshed only when requested. A live Linear source requires connectivity and is not part of this disconnected workflow. Enforce network isolation at the OS or deployment boundary; a self-contained executable is not itself an air gap. Credentials are not included in the distribution.

The release procedure currently verifies macOS/Linux-style execution on the build host. Validate each target platform independently before distributing its artifact.
