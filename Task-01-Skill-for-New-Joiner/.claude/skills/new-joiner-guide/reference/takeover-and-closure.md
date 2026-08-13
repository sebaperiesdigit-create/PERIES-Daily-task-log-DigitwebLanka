# Taking Over Someone Else's Task & the Closure Quality Gate

Source: Mini-AIOS New Joiner Complete Guide §11, §12.4.

## Taking over a task

Because the whole team maintains the same folder structure and file conventions, taking over a task from another member should be simple — no meeting required.

1. Clone the task's folder to your own PC.
2. Open Claude Code inside that folder.
3. Ask it a simple question — Claude Code reads the folder's `CLAUDE.md`, README, evidence, and handover notes and explains the rest (this is read-only inspection — see SKILL.md role boundary).

Copy-paste prompt once inside the folder in Claude Code:

```
From today, I have to take over this task. Can you explain to me
what it is about, what I need to do, where to begin, what has been
done, and what needs to be achieved?
```

**If Claude Code can't answer this clearly, that's a signal the previous owner's handover/evidence was incomplete — flag it to Varmens rather than guessing** what the task is about.

## The Unknown-Developer Test (closure quality gate)

Before considering any task complete, ask: if someone who has never seen this opened the repo tomorrow, could they understand —

- what the task is;
- why it exists;
- what has been completed;
- what evidence proves it;
- what the current state is;
- what they should do next —

without asking the previous owner?

**If the answer is no, the task is not ready for closure.** This applies whether the joiner is closing their own task (task-workflow.md's closure checklist) or being asked whether a task they inherited is actually explainable.
