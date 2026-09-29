# sdcli

An offline command-line guide to the problems of a homework submission platform: what could go wrong, how to confirm the cause, and how to fix it. It answers questions in plain words and can play each problem out as a simulation, first without the fixes and then with them.

It runs fully offline. It makes no network calls, writes no files, collects nothing, and has no dependencies.

## Quickstart

Requires Node 18 or newer.

```
git clone <repo-url>
cd sdcli
npm start
```

## Ask a question

```
sdcli ask "why do reports get stuck?"
sdcli ask "what if the server restarts while evaluating?"
sdcli ask "how do you log the steps?"
sdcli ask "trade-off of staggered deadlines"
sdcli ask "rate limiting and staggered deadlines"
```

A broad question returns the whole problem (issues, fixes, how to confirm the cause, trade-off). A narrow question returns only the matching issue or fix. If nothing in the content matches, the tool says so instead of guessing.

## Watch a problem happen

```
sdcli simulate q2
sdcli simulate q4 --try
sdcli simulate q2 --fixes status,logging,recovery
sdcli simulate q7
```

Each simulation runs the situation without any fix, shows what every fix does on its own, then runs it again with all fixes on. Press Enter to step through, or use `--auto` to play on a timer and `--fast` to print everything at once. With `--try` you switch fixes on and off yourself and run the situation again.

All students, submissions and load numbers are made up and illustrative. Nothing touches a real server.

## Problems covered

| Id | Problem |
| --- | --- |
| q1 | Many students hitting the server at once |
| q2 | Reports getting stuck and never evaluated |
| q3 | Homework getting swapped between students |
| q4 | Live help: two groups trying to join at once |
| q5 | No cross-verification |
| q6 | Leaderboard: seeing your rank before everything is checked |
| q7 | Other problems (double submissions, deadline fairness, live help no-shows, privacy of minors, teacher overload) |

## Commands

| Command | What it does |
| --- | --- |
| `sdcli` | Opening screen with a prompt: type a number to open a problem, or ask anything |
| `sdcli ask "<question>"` | Answer one question and exit |
| `sdcli topics` | List every problem with its issues and fixes |
| `sdcli explain <q1-q7>` | Full answer for one problem |
| `sdcli simulate <q1-q7>` | Play a problem out without and with the fixes |
| `sdcli interview` | Step through the likely questions one by one |
| `sdcli help` | Commands and assumptions |

## Assumptions

- One teacher grades everything
- One live-help teacher
- Live classes with 1,000 to 1,500 students, class size varies
- Live help opens after class, the video part is already built
- Homework is a size-limited PDF
- Leaderboard ranks by marks, finishing time is the tiebreaker
- One homework per student per week

## Tests

```
npm test
```
