// A tiny demo app: login, a task list, an edit form, and a multi-step
// checkout. In-memory state, one fake local user — no real credentials, no
// external services, nothing to configure. This is the app the example
// legacy suite exercises and the migrated suite re-verifies against.

import express from "express";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const FAKE_USER = { username: "demo", password: "demo123" };

let tasks = [
  { id: 1, title: "Write the migration playbook", status: "open" },
  { id: 2, title: "Seed the gotchas file", status: "done" },
  { id: 3, title: "Wire up the evidence contract", status: "open" },
];

function requireSession(req, res, next) {
  if (req.cookies.session !== "ok") return res.redirect("/login");
  next();
}

function page(title, body) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body>${body}</body></html>`;
}

app.get("/login", (req, res) => {
  res.send(
    page(
      "Log in",
      `<h1>Log in</h1>
       <form method="post" action="/login">
         <input id="username" name="username" placeholder="username" />
         <input id="password" name="password" type="password" placeholder="password" />
         <button id="login-submit" type="submit">Log in</button>
       </form>`
    )
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === FAKE_USER.username && password === FAKE_USER.password) {
    res.cookie("session", "ok", { httpOnly: true });
    return res.redirect("/tasks");
  }
  res.status(401).send(
    page(
      "Log in",
      `<h1>Log in</h1>
       <div id="error-banner">Invalid username or password</div>
       <form method="post" action="/login">
         <input id="username" name="username" placeholder="username" />
         <input id="password" name="password" type="password" placeholder="password" />
         <button id="login-submit" type="submit">Log in</button>
       </form>`
    )
  );
});

app.get("/tasks", requireSession, (req, res) => {
  const status = req.query.status;
  const visible = status && status !== "all" ? tasks.filter((t) => t.status === status) : tasks;
  const rows = visible
    .map((t) => `<li>${t.title} [${t.status}] <a href="/tasks/${t.id}/edit">Edit</a></li>`)
    .join("\n");
  res.send(
    page(
      "Tasks",
      `<h1>Tasks</h1>
       <form method="get" action="/tasks">
         <select id="status-filter" name="status" onchange="this.form.submit()">
           <option value="all" ${!status || status === "all" ? "selected" : ""}>All</option>
           <option value="open" ${status === "open" ? "selected" : ""}>Open</option>
           <option value="done" ${status === "done" ? "selected" : ""}>Done</option>
         </select>
       </form>
       <ul id="task-list">${rows}</ul>
       <a href="/checkout/step1">Start checkout</a>`
    )
  );
});

app.get("/tasks/:id/edit", requireSession, (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).send(page("Not found", "<h1>Not found</h1>"));
  res.send(
    page(
      "Edit task",
      `<h1>Edit task</h1>
       <form method="post" action="/tasks/${task.id}/edit">
         <input id="task-title" name="title" value="${task.title}" />
         <select id="task-status" name="status">
           <option value="open" ${task.status === "open" ? "selected" : ""}>Open</option>
           <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
         </select>
         <button id="save-task" type="submit">Save</button>
       </form>`
    )
  );
});

app.post("/tasks/:id/edit", requireSession, (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).send(page("Not found", "<h1>Not found</h1>"));
  task.title = req.body.title;
  task.status = req.body.status;
  res.redirect("/tasks");
});

// --- multi-step checkout: quantity -> shipping address -> confirm -> done ---

app.get("/checkout/step1", requireSession, (req, res) => {
  res.send(
    page(
      "Checkout — quantity",
      `<h1>Checkout: choose quantity</h1>
       <form method="post" action="/checkout/step1">
         <select id="item-quantity" name="quantity">
           <option value="1">1</option>
           <option value="2">2</option>
           <option value="3">3</option>
         </select>
         <button id="checkout-next" type="submit">Next</button>
       </form>`
    )
  );
});

app.post("/checkout/step1", requireSession, (req, res) => {
  res.cookie("checkout_quantity", req.body.quantity);
  res.redirect("/checkout/step2");
});

app.get("/checkout/step2", requireSession, (req, res) => {
  res.send(
    page(
      "Checkout — shipping",
      `<h1>Checkout: shipping address</h1>
       <form method="post" action="/checkout/step2">
         <input id="shipping-address" name="address" placeholder="123 Example St" />
         <button id="checkout-next" type="submit">Next</button>
       </form>`
    )
  );
});

app.post("/checkout/step2", requireSession, (req, res) => {
  res.cookie("checkout_address", req.body.address);
  res.redirect("/checkout/confirm");
});

app.get("/checkout/confirm", requireSession, (req, res) => {
  res.send(
    page(
      "Checkout — confirm",
      `<h1>Confirm order</h1>
       <p id="checkout-summary">Quantity: ${req.cookies.checkout_quantity}, Ship to: ${req.cookies.checkout_address}</p>
       <form method="post" action="/checkout/confirm">
         <button id="checkout-submit" type="submit">Place order</button>
       </form>`
    )
  );
});

app.post("/checkout/confirm", requireSession, (req, res) => {
  // Deliberately no email-confirmation feature — the example legacy suite's
  // "confirmation email sent" assertion has nothing to map to here, and the
  // migrated test records that as an explicit dropped assertion rather than
  // silently losing it. See example/legacy-tests/checkout-flow.spec.js.
  res.send(page("Checkout — done", `<h1>Order placed</h1><div id="checkout-confirmation">Order placed!</div>`));
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`demo app listening on http://localhost:${port}`));
