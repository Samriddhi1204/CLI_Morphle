export const ASSUMPTIONS = [
  "One teacher grades everything",
  "One live-help teacher",
  "Live classes with 1,000 to 1,500 students, class size varies",
  "Live help opens after class, the video part is already built",
  "Homework is a size-limited PDF",
  "Leaderboard ranks by marks, finishing time is the tiebreaker",
  "One homework per student per week",
];

export const PROBLEMS = [
  {
    id: "q1",
    label: "Q1",
    menuTitle: "Many students hitting the server at once",
    title: "Many students hit the server at the same time",
    oneLine: "1,500 students submit around the same deadline and the server struggles.",
    aliases: "server crash overload traffic rush deadline load many students simultaneous",
    issues: [
      ["Single server", "Everything runs on a single server, so CPU or memory runs out near the deadline", "one server overload cpu memory crash"],
      ["Heavy work in the request", "Heavy work (saving and processing the PDF) happens inside the request, so requests take long and pile up", "slow requests pile up processing pdf inside request"],
      ["Slow database queries", "Slow database queries, for example fetching submissions with no index", "slow query no index database"],
      ["No request limit", "No limit on how often one student (or a script) can call the server", "spam script flood too many requests"],
      ["Same deadline for everyone", "Everyone has the same deadline, so all hit the server together", "deadline rush last minute everyone together"],
    ],
    fixes: [
      ["rateLimit", "Rate limiting", "Rate limiting per student (for example 60 requests a minute), with a \"try again in a moment\" message", "throttle limit requests per minute spam script"],
      ["loadBalancer", "Load balancer", "Load balancer (like Nginx) with 2 or more copies of the server, so one failure does not take the site down", "nginx multiple servers copies distribute traffic"],
      ["queue", "Background queue", "Background queue: the request only saves the file and replies \"received\", the rest happens in the background", "async background processing received"],
      ["index", "Database index", "Database index on studentId and assignmentId", "index query speed slow database"],
      ["stagger", "Staggered deadlines", "Staggered deadlines: students split into slots with a gap between them, each slot gets the same amount of time, deadline stored per student or slot", "slots gap spread deadlines different deadline"],
      ["reminders", "Reminders", "Reminders before each deadline so submissions do not bunch up at the last minute", "reminder notify early submit"],
    ],
    confirm: "Check CPU and memory at peak time, request duration in the logs, and the slowest queries.",
    tradeoff: "A few students may see \"try again\" during a spike, but the site stays up. Slots must feel fair, so rotate them across assignments.",
  },
  {
    id: "q2",
    label: "Q2",
    menuTitle: "Reports getting stuck and never evaluated",
    title: "Reports get stuck and never get evaluated",
    oneLine: "Some submissions are never evaluated and nobody notices.",
    aliases: "stuck reports never evaluated queue evaluating pending lost submission not graded",
    issues: [
      ["Server restarted mid-job", "A job was picked up, then the server restarted or the code errored, and the status was never updated", "restart crash error status never updated"],
      ["Queueing failed", "The submission was saved but adding it to the queue failed, so the evaluator never heard about it", "saved not queued queue failed"],
      ["Corrupted file", "One bad file (corrupted PDF) crashed the process and blocked the jobs behind it", "bad file corrupted pdf crash blocked"],
      ["Queue full", "The queue was full and new jobs were dropped", "queue full dropped jobs"],
      ["No timeout", "No timeout, so \"evaluating\" can last forever", "timeout forever evaluating never ends"],
    ],
    fixes: [
      ["status", "Status field", "Status field: unmarked -> evaluating -> marked. Only unmarked items get picked up", "unmarked marked state skip already marked"],
      ["logging", "Step-by-step logging", "Step-by-step logging: every step (received, saved, queued, picked up, marked) prints a log line with the submission ID and time", "console log root cause request id trace"],
      ["recovery", "Auto-recovery", "Auto-recovery: if a submission stays in evaluating for more than 10 minutes, it goes back to unmarked", "timeout retry reset stuck evaluating"],
      ["queueCheck", "Queue check", "Queue check: if queueing fails, show the student an error instead of a false \"submitted\"", "queueing fails error false submitted"],
      ["uploadChecks", "Upload checks", "Upload checks: reject corrupted or empty PDFs so a bad file never enters the queue", "reject corrupted empty pdf validate upload"],
      ["queueSize", "Queue size", "Queue size: watch how many items are waiting, if it keeps growing run more background processors or raise the queue limit", "queue capacity extend more workers processors"],
      ["results", "Results table", "Results table: finished work moves out of the queue into a separate results table", "evaluated data separate table move out of queue"],
      ["perStudent", "One job per student", "One job per student: each submission is its own job tied to that student's ID, so one stuck report cannot block or mix with another", "separate pipeline per student isolate"],
      ["pending", "Pending too long list", "\"Pending too long\" list for the teacher", "overdue pending list teacher"],
      ["popup", "Teacher popup", "Teacher popup: \"Are you sure?\" with the score shown before grades are submitted (prevents accidents, does not fix stuck reports)", "confirm popup teacher sure before submitting grades"],
    ],
    confirm: "Search the logs for the stuck submission's ID and see the last step it reached. Saved but never queued means a queueing problem. Started evaluating and stopped means a crash or error.",
    tradeoff: "More statuses and logs mean a bit more code, but nothing disappears silently.",
  },
  {
    id: "q3",
    label: "Q3",
    menuTitle: "Homework getting swapped between students",
    title: "Students' homework gets swapped",
    oneLine: "One student's homework shows up under another student.",
    aliases: "swapped homework mixed up wrong student overwrite race condition",
    issues: [
      ["Same file name", "Every upload is saved under the same file name (like homework.pdf), so simultaneous uploads overwrite each other", "same name overwrite homework pdf"],
      ["Lookup by assignment only", "The code finds a submission by assignment ID only, not student ID, and returns the wrong record", "lookup assignment id only wrong record"],
      ["Shared variable", "A shared or global variable on the server holds data, so two requests at the same time overwrite each other's values", "global variable shared state overwrite requests"],
      ["Cache by assignment only", "Caching by assignment only, so one student's data is served to another", "cache assignment served to another student"],
      ["Two evaluators", "Two evaluators pick the same document", "two evaluators same document twice"],
    ],
    fixes: [
      ["uniqueNames", "Unique file names", "Unique file names: studentId_assignmentId_timestamp.pdf", "file name unique timestamp"],
      ["lookupBoth", "Lookup by both IDs", "Always look up by both studentId and assignmentId", "query student and assignment both"],
      ["uniqueRule", "Unique rule in the database", "Unique rule in the database on studentId + assignmentId (+ attempt), so one record cannot overwrite another", "unique constraint duplicate record attempt"],
      ["prisma", "Prisma", "Prisma for queries, so they are written in a consistent, checked way", "prisma orm query database"],
      ["noGlobals", "No global variables", "No student data in global variables on the server", "global variables shared state"],
      ["statusCheck", "Status check", "Status check: skip anything already marked, and change unmarked to evaluating in one step so two processes never pick the same document", "already marked skip claim one step evaluators"],
    ],
    confirm: "Check how files are named, how the lookup query is written, and whether any variable is shared across requests, then reproduce it with two test students uploading at the same moment.",
    tradeoff: "Slightly stricter saving rules, but swapping is prevented at the database level, not only in code.",
  },
  {
    id: "q4",
    label: "Q4",
    menuTitle: "Live help: two groups trying to join at once",
    title: "Two groups of 20 try to join the same live help session at once",
    oneLine: "Two students click Join for the last seat at the same moment.",
    aliases: "live help seats join capacity race condition waiting list groups session",
    issues: [
      ["Check and add are two steps", "The code checks \"fewer than 20?\" and adds the student as two separate steps, so two students clicking together both see 19 and both get in, making it 21", "race condition last seat both get in 21 two steps"],
      ["Both groups told there is room", "Both groups are told there is room", "both groups room over capacity"],
      ["Hard-coded capacity", "The capacity is hard-coded, with no waiting list as a fallback", "capacity fixed hard coded no waiting list"],
      ["No login needed", "Anyone can try to join without logging in", "not logged in guest join authentication"],
      ["Students who need help miss out", "Students who need help most may miss out", "left out weak students miss out"],
    ],
    fixes: [
      ["auth", "Authentication", "Authenticate every student before joining", "login authenticate token"],
      ["oneStep", "Seat reserved in one step", "Reserve the seat in one database step, so only one student gets the last seat and the other gets a clear message", "atomic reserve seat one step race"],
      ["capacity", "Capacity as a setting", "Capacity as a setting, not a fixed 20", "configurable capacity limit setting"],
      ["waitlist", "Waiting list", "Waiting list: students without a seat see their position and move up automatically when a seat frees up", "waiting list queue position promote"],
      ["marks", "Selection by marks", "Selection by marks in the last few tests, with rotation so the same students do not always get priority", "select batch marks past tests priority rotation fair"],
      ["balancer", "Load balancing", "Load balancing so the join page does not slow down", "load balancer join page slow"],
      ["listenOnly", "Listen-only option", "Listen-only option for waiting students", "listen only waiting students"],
      ["noShow", "No-show release", "No-show release: if a student does not confirm within 2 minutes, the seat goes to the next in line", "no show confirm two minutes release seat"],
    ],
    confirm: "Log every join request with its time and the current count, and check whether two requests read the same count.",
    tradeoff: "The live-help teacher can only handle so many students, which is why the waiting list is needed.",
  },
  {
    id: "q5",
    label: "Q5",
    menuTitle: "No cross-verification",
    title: "No cross-verification",
    oneLine: "Anything is accepted and nothing is double-checked.",
    aliases: "cross verification verify check summary receipt validation history audit",
    issues: [
      ["Everything is trusted", "The system trusts whatever comes in: any upload is accepted and any score is saved", "trusts accepts any upload any score"],
      ["No confirmation", "No summary or confirmation before submitting", "no summary confirmation before submit"],
      ["No change history", "No record of who changed what, so mistakes cannot be traced", "no history who changed audit trace"],
      ["No receipt", "No receipt, so students and teacher cannot verify a submission later", "no receipt proof of submission"],
      ["Silent duplicates", "The same file can be uploaded twice with no warning", "duplicate upload twice no warning"],
    ],
    fixes: [
      ["fileChecks", "File checks", "File checks at upload: PDF only, size limit, not empty or corrupted", "pdf only size limit empty corrupted validate"],
      ["summary", "Student summary screen", "Summary screen before the student submits (name, assignment, file name, size, time), then confirm", "summary screen before submit confirm"],
      ["receipt", "Receipt", "Receipt with submission ID and time after submitting", "receipt submission id time"],
      ["teacherPopup", "Teacher summary and popup", "Teacher summary and popup before final grades are saved (student, assignment, score, comments)", "teacher summary popup are you sure grades"],
      ["duplicate", "Duplicate check", "Duplicate check: flag the same file uploaded twice", "duplicate same file twice flag"],
      ["history", "History of changes", "History of changes: who, when, old value, new value", "change history audit who when old new"],
    ],
    confirm: "This is mostly a design gap, so walk through the flow and list every point where data enters without being checked.",
    tradeoff: "One extra click for students and teacher, but far fewer mistakes.",
  },
  {
    id: "q6",
    label: "Q6",
    menuTitle: "Leaderboard: seeing your rank before everything is checked",
    title: "Leaderboard: seeing rank before everything is checked",
    oneLine: "Students see nothing until every submission is graded.",
    aliases: "leaderboard rank point board provisional live updates batch global marks finishing time",
    issues: [
      ["Ranks appear too late", "Ranks appear only after every submission is graded, so students wait with no information", "ranks late wait everything graded"],
      ["Own work not shown", "Students whose work is not evaluated yet see nothing", "own status not evaluated nothing"],
      ["Slow board", "The board loads slowly with 1,500 rows", "slow loading 1500 rows"],
      ["Real names shown", "The public board shows real names of children", "real names children privacy public"],
    ],
    fixes: [
      ["showAll", "Show all students", "Show all students, with the student's own row highlighted", "all students not top 10 own row highlighted"],
      ["progress", "Progress line", "Progress line: \"Evaluated: 640 of 1,500\"", "evaluated so far progress count"],
      ["provisional", "Provisional rank", "Rank among evaluated so far: \"Your rank: 212 of 640 evaluated\", labelled provisional", "rank among evaluated provisional"],
      ["ownStatus", "Own status", "If the student's own work is not evaluated yet, show its status: submitted -> under review -> evaluated", "own status submitted under review evaluated"],
      ["realtime", "Real-time updates", "Real-time updates with WebSockets each time the teacher confirms a grade", "websocket live real time update progression"],
      ["twoBoards", "Batch and global boards", "Two boards: batch and global, ranked by marks with finishing time as tiebreaker", "batch global board tiebreaker finishing time"],
      ["paging", "Pages and jump to my rank", "Pages or scrolling with a \"jump to my rank\" button", "pagination scrolling jump to my rank"],
      ["nickname", "Nickname or initials", "Nickname or initials option for privacy", "nickname initials privacy"],
    ],
    confirm: "",
    tradeoff: "Provisional ranks can move up or down, but students would rather see a moving rank than nothing.",
  },
];

export const OTHER = {
  id: "q7",
  label: "Q7",
  menuTitle: "Other problems I'd identify",
  title: "Other problems I'd identify",
  oneLine: "Five more problems the system would run into.",
  aliases: "other problems additional issues",
  items: [
    {
      id: "q7-1",
      title: "Double submissions and resubmissions",
      aliases: "double click refresh duplicate resubmit attempts",
      wrong: [
        ["Two copies saved", "A student double-clicks or refreshes and two copies are saved", "double click refresh two copies"],
        ["Unclear which version counts", "A student uploads again and nobody knows which version counts", "upload again which version counts"],
        ["Wrong copy graded", "The teacher may grade the wrong copy", "teacher grades wrong copy"],
      ],
      fixes: [
        ["disableButton", "Disable the submit button", "Disable the submit button after the first click and reject duplicates on the server", "disable button double click reject duplicates"],
        ["attempts", "Keep attempts", "Keep every upload as an attempt and count the latest one before the deadline", "attempts latest before deadline counted"],
        ["keepOlder", "Keep older versions", "Keep older versions saved", "older versions saved"],
        ["showCounted", "Show the counted version", "Show the teacher only the counted version", "teacher sees counted version only"],
      ],
    },
    {
      id: "q7-2",
      title: "Deadline unfairness and time cheating",
      aliases: "deadline unfair time cheating device clock server time slow internet",
      wrong: [
        ["Device clock", "The deadline is checked using the student's device clock, so it can be changed", "device clock changed"],
        ["Slow internet", "Slow internet makes an on-time student look late", "slow internet late on time"],
        ["Unfair slots", "With staggered deadlines, some slots may feel unfair", "unfair slots staggered"],
      ],
      fixes: [
        ["serverTime", "Server time", "Always use server time to decide on-time or late", "server time on time late"],
        ["uploadStart", "Record upload start", "Record the time the upload started as well as when it finished", "upload started finished time"],
        ["perSlotDeadline", "Deadline per student or slot", "Store the deadline per student or slot", "deadline per student slot stored"],
        ["equalSlots", "Equal time in every slot", "Give every slot the same amount of time", "same amount of time every slot"],
        ["rotate", "Rotate slots", "Rotate slots across assignments", "rotate slots across assignments"],
      ],
    },
    {
      id: "q7-3",
      title: "Live help no-shows",
      aliases: "live help no show seat wasted confirm release",
      wrong: [
        ["Seat wasted", "A student takes a seat and never joins, so a seat is wasted while others wait", "seat wasted never joins"],
        ["Empty seats, long waiting list", "The teacher sits with empty seats and a long waiting list", "teacher empty seats long waiting list"],
      ],
      fixes: [
        ["confirm", "Confirm within 2 minutes", "The student must confirm within 2 minutes, otherwise the seat is released", "confirm two minutes seat released"],
        ["releaseNext", "Release to the next student", "Release it to the next student on the waiting list automatically", "release next student waiting list"],
        ["showPosition", "Show waiting position", "Show waiting students their position", "waiting position shown"],
        ["lowerPriority", "Lower priority for repeat no-shows", "Students who no-show repeatedly get lower priority next time", "repeat no show lower priority"],
      ],
    },
    {
      id: "q7-4",
      title: "Privacy of minors and access control",
      aliases: "privacy minors children access control parent consent role based nickname logs private storage",
      wrong: [
        ["Real names on the board", "The public leaderboard shows real names of children", "real names public leaderboard children"],
        ["Changing the ID in the URL", "A student could open another student's homework or marks by changing the ID in the URL", "change id url open another student homework"],
        ["Personal data in logs", "Personal data ends up in logs", "personal data logs names emails"],
      ],
      fixes: [
        ["consent", "Parent consent", "Get parent consent at signup", "parent consent signup"],
        ["nickname", "Nickname or initials", "Let students appear on the leaderboard with a nickname or initials", "nickname initials leaderboard"],
        ["rbac", "Role-based access", "Role-based access (a student sees only their own data, the teacher sees all, the live-help teacher sees only what they need)", "role based access rbac"],
        ["roleEveryRequest", "Role checked on every request", "Check the logged-in user's role on every request, not just on the page", "role check every request"],
        ["logIds", "Log IDs, not names", "Log IDs, not names or emails", "log ids not names emails"],
        ["privateStorage", "Private storage and short-lived links", "Keep PDFs in private storage and open them only through short-lived links", "private storage short lived links pdf"],
      ],
    },
    {
      id: "q7-5",
      title: "Single teacher dependency and overload",
      aliases: "single teacher overload bottleneck absent grading queue snippets common mistakes backup",
      wrong: [
        ["Bottleneck", "One teacher grading 1,500 submissions is a bottleneck", "one teacher 1500 submissions bottleneck"],
        ["Teacher absent", "If the teacher is absent or unwell, grading stops", "teacher absent unwell grading stops"],
        ["Random order", "Submissions are graded in random order, so urgent ones wait", "random order urgent wait"],
      ],
      fixes: [
        ["sortedQueue", "Grading queue sorted by deadline", "A grading queue sorted by deadline with a \"next submission\" button", "grading queue sorted deadline next submission"],
        ["snippets", "Saved comment snippets", "Saved comment snippets (\"missing units\", \"good approach\") so feedback is one click", "comment snippets feedback one click"],
        ["autoFlags", "Auto-flags", "Auto-flag late, blank or duplicate files before they reach the teacher", "auto flag late blank duplicate"],
        ["backupAccess", "Backup access", "Give the live-help teacher or an admin backup access to the queue", "backup access live help teacher admin"],
        ["commonMistakes", "Common mistakes summary", "Show a \"common mistakes\" summary per assignment so the teacher can explain it once in class", "common mistakes summary explain once"],
        ["staggerLoad", "Staggered deadlines spread the load", "The staggered deadlines from Q1 spread this load out as well", "staggered deadlines spread load"],
      ],
    },
  ],
};

export function findProblem(id) {
  const key = String(id).toLowerCase();
  return [...PROBLEMS, OTHER].find((problem) => problem.id === key);
}

export function fixList(id) {
  const problem = findProblem(id);
  if (!problem) return [];
  if (problem.items) {
    return problem.items.flatMap((item) => item.fixes.map(([fixId, title]) => ({ id: fixId, label: title })));
  }
  return problem.fixes.map(([fixId, title]) => ({ id: fixId, label: title }));
}
