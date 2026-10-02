# yalikedags

![Do ya like dags?](dags.png)

> "Ya like dags?"
> "Dags?"
> "Dags. Ya like dags?"
> "Oh, dogs. Sure, I like dags. I like caravans more."
>
> Mickey O'Neil, *Snatch* (2000). This tool is about the other kind.

## What's all this, then?

Right. So you've got a Linear project, yeah? Two hundred-odd cards, all sat there like they're waiting for a fight what's never gonna happen. And nobody can tell ya which one comes first, which one's holding up the rest, or which ones are the same job wearing two hats. That's what this is for.

### ***yalikedags reads your Linear project, builds the dependency DAG out of it, tells ya what's ready, what's blocked, where the long chain is, and which cards are talking rubbish. Then it draws the whole thing so ya can look at it proper. Two ways an' all: the graph, for how it all hangs together, and the grid, workstreams down the side and waves across the top, for who could be doing what this round.***

## Put the plan back where the work is

Now, if the dependencies live in a file on your machine and not in Linear, where everyone can see 'em, that's no good to anybody, is it? Well, this'ere'll work out the difference, and write ya a lovely plan. Ya read it first. Nothing in Linear moves till ya say `--confirm`. Then it does the job and goes back and checks the job got done. Till then, good dag. Stays put.

## 🐾 Who's it for?

Ah, don't ya know? It's for the whole team. Everyone's mints their own Linear key an puts in their own keychain, then everyone starts the server, an' everyone sees the same graph. Just like that, ya see? Linear keeps the truth, lad; this just has the good sense to draw it.

###  🐶 Take it with ya

And when ya want to show yer mam, er someone else has ta see it, who hasn't got the tool, or ya key, or the first idea what a terminal is, use `render --format html --out dag.html` and out pops one file. Whole viewer in it, graph and all. Self-contained. Simple. Opens by a quick double-click, asks the internet for nothing, works on a plane, shows ya just like that.

*Mind who ya send it to, though:* the file's got the cards and people's names in it. Pick **Structure only** in Import/Export, or add `--redact`, to leave those out, if yer paranoid. But don't we didn't warn ya: the graph's shape can still give a project away; [here's what travels with the file](SECURITY.md#export-contents-and-retention).

### ♟️ Find the next move

What's ready? What'll it unblock? What's standing between ya and done? The viewer puts that bit up front. Have a look at the dependencies, line the work up in waves, or find a card in the task list. Pick one and its details open beside it. Findings calls out the dodgy cards. There's a little dag keeping ya company an' all. [Have a look round](docs/how-to/open-the-viewer.md).

## 📍 Start here

Well? What are ya waiting for? Get a graph on screen. It'll take ya about two minutes, off the bundled example, no key needed: [See your first DAG](docs/tutorials/first-dag.md). Even me mam figured it out on her own, this one.

### 👀 What ya lookin' to do?

- [Put ya Linear key somewhere safe](docs/how-to/store-the-linear-key.md) (once, then forget it)
- [Get ya project out of Linear](docs/how-to/sync-a-project.md)
- [Find the missing links and cards that need splitting](docs/how-to/audit-a-project.md)
- [Have a look at the thing](docs/how-to/open-the-viewer.md), or save it as one file ya can send someone
- [Put the dependencies back in Linear](docs/how-to/reconcile-into-linear.md), after ya've read the plan
- [Take the whole tool offline](docs/how-to/install-offline.md), for where the internet doesn't come with ya

### 🕵️‍♂️ Need particulars?

- [What to type and what the switches do](docs/reference/cli.md)
- [What those exit numbers mean](docs/reference/exit-codes.md)
- [What's in a saved project](docs/reference/snapshot.md)
- [What's in the plan, and the receipt when it's done](docs/reference/plan.md)
- [Where the buttons are and what they do](docs/reference/viewer.md)
- [What stays local and what gets shared](SECURITY.md)

###  🎓 How's it work, then?

- [One job, one PR, working when it lands](docs/explanation/atomic-work.md)
- [How it works out what's ready and what's holding ya up](docs/explanation/derived-views.md)
- [What Linear tells us and what we work out ourselves](docs/explanation/source-of-truth.md)

### 🫣 When luck runs out

[Something won't play ball?](docs/troubleshooting/index.md) Won't sync, dependencies going round in circles, a card pointing off somewhere it shouldn't. Start there.

### 🦮 Kit you'll need

- [bun](https://bun.sh) 1.2 or newer to run it.
- A Linear personal API key if ya want ya own project. [Stick it in the keychain](docs/how-to/store-the-linear-key.md) and be done with it. The bundled example needs no key.
- GraphViz `dot` if ya want to draw the `.dot` files yourself. The viewer does its own drawing.

##  🕹️ Give it a go

```bash
bun install
bun src/cli.ts render --tasklist examples/example-tasklist.txt
```

Ya should get this sort of thing. Cut down a bit so we're not here all day:

```text
loaded 12 tasks from task list examples/example-tasklist.txt
task list examples/example-tasklist.txt, as of <today>: 12 tasks (2 done, 2 ready, 7 blocked, 1 in-progress)

frontier (2 ready tasks, most urgent first):
  implement-core-dag-builder  Implement core DAG builder  immediately-unblocks:2  downstream-impact:7
  write-documentation  Write documentation  immediately-unblocks:1  downstream-impact:2
...
critical path by depth: 6 tasks: implement-core-dag-builder then ... then deploy-to-production
```

## Want to customize it? Here's how ya change it, and how to share it back, if ya want to.

Fancy getting under the bonnet? Read [the house rules](CONTRIBUTING.md) and [how it's put together](docs/contributing/architecture.md). Tests first. Keep real project stuff out of it. Run `bun run check` before ya push or the hooks'll have ya.

## Licence

Apache 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Dag not included.
