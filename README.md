# yalikedags

![Do ya like dags?](dags.png)

> "Ya like dags?"
> "Dags?"
> "Dags. Ya like dags?"
> "Oh, dogs. Sure, I like dags. I like caravans more."
>
> Mickey O'Neil, *Snatch* (2000). This tool is about the other kind.

## What's all this, then?

Sure, you've a Linear project. Two hundred cards in it. Everyone's busy, nobody can start, and the fella who knows what's holding it up is away till Monday. Half the cards are the same job wearing different hats. Lovely. We'll have a look, so.

### ***yalikedags reads your Linear project and draws the dependencies. Shows ya what can start, what's waiting on what, and the long chain between you and going home. A graph to see how it hangs together, a grid to see who could get on with what. Finds the cards that need a talking-to as well. All in the one place.***

## Put the plan back where the work is

No use having the plan on your machine if the rest of them are looking in Linear. It'll work out the difference and write it down for ya. Have a read. Happy with it? Say `--confirm` and it'll make the changes, then check they're done. Till then, good dag. Stays put.

## 🐾 Who's it for?

The lot of ya. Each gets their own Linear key, puts it in their own keychain, and opens the same project. Same work, same graph. No passing keys round. Linear keeps the books; this draws the picture.

### 🐶 Take it with ya

Want to show your mam? She's not installing all this. Use `render --format html --out dag.html` and give her the file. One file, the whole viewer in it. Double-click and there's your graph. No key, no internet. Works on a plane, if you're going somewhere.

*Mind who gets a copy.* The cards and people's names go with it. Pick **Structure only** in Import/Export, or add `--redact`, to leave those out. Someone who knows the project might still recognise the shape. [Have a look at what's in the file](SECURITY.md#export-contents-and-retention) before ya send it round.

### ♟️ Find the next move

Start with what can be done now. It'll show ya what that frees up next. Follow the dependencies, line the work up in waves, or pick a card and see what's in it. Findings has the ones that need sorting out. There's a little dag to keep ya company, too. Doesn't do the work for ya. [Come and have a look](docs/how-to/open-the-viewer.md).

Canceled the card that was meant to unblock it? That doesn't mean the work got done. The dependent chain stays unresolved until ya review and correct the dependency. Findings and the task details show what's missing.

Waves also shows ya the shared prerequisites and the cards left outside the forecast. Those workstreams are temporary groups, not team commitments. [See what's accounted for](docs/reference/viewer.md#planning-coverage-disclosure).

Had a proper look at the dependencies? **Review dependencies** lets ya record what ya checked, which relationships ya accept, and what still needs sorting. Change the underlying cards and it'll tell ya the review is stale. A review isn't a promise that nothing's missing. [Here's how it works](docs/reference/viewer.md#record-a-dependency-review).

Missing a blocker? **Discover candidate dependencies** looks for issue references in the cards and shows ya what it found. Check the evidence, accept or reject it, and preview what changes. Nothing goes back to Linear until ya review the plan and explicitly apply it. [Show me how](docs/reference/viewer.md#discover-and-review-candidate-dependencies).

## 📍 Start here

Go on, try the example. No key needed, about two minutes: [See your first DAG](docs/tutorials/first-dag.md). My mam's already got hers open. She's asking why you're still reading.

### 👀 What ya lookin' to do?

- [Put your Linear key somewhere safe](docs/how-to/store-the-linear-key.md) (once, then forget it)
- [Get your project out of Linear](docs/how-to/sync-a-project.md)
- [Find the missing links and cards that need splitting](docs/how-to/audit-a-project.md)
- [Have a look at the thing](docs/how-to/open-the-viewer.md), or save it as one file ya can send someone
- [Put the dependencies back in Linear](docs/how-to/reconcile-into-linear.md), once you've read the plan
- [Take the whole tool offline](docs/how-to/install-offline.md), in case the internet doesn't come with ya

### 🕵️‍♂️ Need particulars?

- [What to type and what the switches do](docs/reference/cli.md)
- [What those exit numbers mean](docs/reference/exit-codes.md)
- [What's in a saved project](docs/reference/snapshot.md)
- [What's in the plan, and the receipt when it's done](docs/reference/plan.md)
- [Where the buttons are and what they do](docs/reference/viewer.md)
- [What stays local and what gets shared](SECURITY.md)

### 🎓 How's it work, then?

- [One job, one PR, working when it lands](docs/explanation/atomic-work.md)
- [How it works out what's ready and what's holding ya up](docs/explanation/derived-views.md)
- [What Linear tells us and what we work out ourselves](docs/explanation/source-of-truth.md)

### 🫣 When luck runs out

[Something won't play ball?](docs/troubleshooting/index.md) Won't sync, dependencies going round in circles, a card pointing off somewhere it shouldn't. Start there.

### 🦮 Kit you'll need

- [bun](https://bun.sh) 1.2 or newer to run it.
- A Linear personal API key for your own project. [Stick it in the keychain](docs/how-to/store-the-linear-key.md) and be done with it. The example needs no key.
- GraphViz `dot` if ya want to draw the `.dot` files yourself. The viewer does its own drawing.

## 🕹️ Give it a go

```bash
bun install
bun src/cli.ts render --tasklist examples/example-tasklist.txt
```

You'll get something like this. I've cut it short; we've things to be doing:

```text
loaded 12 tasks from task list examples/example-tasklist.txt
task list examples/example-tasklist.txt, as of <today>: 12 tasks (2 done, 2 ready, 7 blocked, 1 in-progress)

frontier (2 ready tasks, most urgent first):
  implement-core-dag-builder  Implement core DAG builder  immediately-unblocks:2  downstream-impact:7
  write-documentation  Write documentation  immediately-unblocks:1  downstream-impact:2
...
critical path by depth: 6 tasks: implement-core-dag-builder then ... then deploy-to-production
```

## Got a better way of doing it?

Have a look at [the house rules](CONTRIBUTING.md) and [how it's put together](docs/contributing/architecture.md), then show us. Tests first, real project business kept out of it. Run `bun run check` before ya push. Bring it back working, now.

## Licence

Apache 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Dag not included.
