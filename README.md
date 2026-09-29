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

## Change the scenario

Every simulation number that matters can be changed from the command line. Each parameter has a default, so you only pass what you want to change. Values are checked, and a bad value or a parameter that does not belong to that simulation is refused with a message.

```
sdcli simulate q1 --students 3000 --servers 3
sdcli simulate q2 --queue-limit 2 --workers 2 --recovery-minutes 5
sdcli simulate q4 --capacity 8
sdcli simulate q6 --students 300 --batch-size 10 --seed 3
```

| Parameter | Simulation | Default | Range | Meaning |
| --- | --- | --- | --- | --- |
| `--students` | q1, q6 | 1500 | 10 to 10000 | Students in the simulation |
| `--servers` | q1 | 2 | 2 to 10 | Server copies behind the load balancer |
| `--rate-limit` | q1 | 60 | 1 to 1000 | Requests per student per minute |
| `--script-clients` | q1 | 10 | 0 to 100 | Script clients that spam the server |
| `--queue-limit` | q2 | 4 | 1 to 50 | Jobs the queue can hold |
| `--workers` | q2 | 1 | 1 to 10 | Background processors |
| `--recovery-minutes` | q2 | 10 | 1 to 60 | Minutes in evaluating before a job is reset |
| `--capacity` | q4 | 20 | 3 to 200 | Live help seats |
| `--batch-size` | q6 | 30 | 5 to 500 | Students per batch |
| `--seed` | q6 | 7 | 0 to 999999 | Random seed for the made-up students |

With `--try` you can also change a parameter while playing, for example `set capacity 8`. The same seed always gives the same run.

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
