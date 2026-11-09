const DAY_ORDER = ["Friday 13 November", "Saturday 14 November", "Sunday 15 November"];
const ROOM_ORDER = ["Cornwall 1", "Cornwall 2", "Sussex"];

const storytellersById = new Map(
  convention.storytellers.map((person) => [person.id, person])
);

const games = convention.schedule.filter((item) => item.kind === "game");

function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
  }
  for (const child of children || []) node.append(child);
  return node;
}

function clockParts(time) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  return {
    hour12: hour % 12 || 12,
    minute: String(Number(minuteText)).padStart(2, "0"),
    period: hour >= 12 ? "pm" : "am"
  };
}

function formatRange(time, end) {
  const start = clockParts(time);
  if (!end) return `${start.hour12}:${start.minute} ${start.period}`;
  const finish = clockParts(end);
  if (start.period === finish.period) {
    return `${start.hour12}:${start.minute}–${finish.hour12}:${finish.minute} ${start.period}`;
  }
  return `${start.hour12}:${start.minute} ${start.period}–${finish.hour12}:${finish.minute} ${finish.period}`;
}

function roomRank(room) {
  if (!room) return -1;
  const index = ROOM_ORDER.indexOf(room);
  return index === -1 ? ROOM_ORDER.length : index;
}

function dayRank(day) {
  const index = DAY_ORDER.indexOf(day);
  return index === -1 ? DAY_ORDER.length : index;
}

function byScheduleOrder(a, b) {
  const dayDiff = dayRank(a.day) - dayRank(b.day);
  if (dayDiff !== 0) return dayDiff;
  return a.time.localeCompare(b.time);
}

function groupedSchedule() {
  const byDay = new Map();
  for (const item of convention.schedule) {
    if (!byDay.has(item.day)) byDay.set(item.day, new Map());
    const bySlot = byDay.get(item.day);
    const key = `${item.time}|${item.end || ""}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key).push(item);
  }

  return [...byDay.keys()]
    .sort((a, b) => dayRank(a) - dayRank(b) || a.localeCompare(b))
    .map((day) => ({
      day,
      times: [...byDay.get(day).entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, items]) => {
          const [time, end] = key.split("|");
          items.sort((a, b) => roomRank(a.room) - roomRank(b.room));
          return { time, end, items };
        })
    }));
}

function parseRoute() {
  const parts = (location.hash.replace(/^#/, "") || "/")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "games" && parts[1]) return { name: "game", id: parts[1] };
  if (parts[0] === "storytellers" && parts[1]) return { name: "storyteller", id: parts[1] };
  return { name: "missing" };
}

function tellerLinks(ids) {
  const people = ids.map((id) => storytellersById.get(id)).filter(Boolean);
  const fragment = document.createDocumentFragment();
  people.forEach((person, index) => {
    if (index > 0) fragment.append(index === people.length - 1 ? " and " : ", ");
    fragment.append(
      el("a", {
        className: "person-link",
        href: `#/storytellers/${person.id}`,
        text: person.name
      })
    );
  });
  return fragment;
}

function gameSlot(game) {
  const children = [];
  if (game.room) children.push(el("p", { className: "room", text: game.room }));
  children.push(
    el("a", {
      className: "script-link",
      href: `#/games/${game.id}`,
      text: game.scriptName
    })
  );
  if (game.storytellerIds.length) {
    const tellers = el("p", {
      className: game.grimionIds.length ? "tellers" : "tellers tellers-last"
    });
    tellers.append(el("span", { className: "st-prefix", text: "ST: " }));
    tellers.append(tellerLinks(game.storytellerIds));
    children.push(tellers);
  }
  if (game.grimionIds.length) {
    const grimions = el("p", { className: "grimions" });
    grimions.append(el("span", { className: "st-prefix", text: "Grimion: " }));
    grimions.append(tellerLinks(game.grimionIds));
    children.push(grimions);
  }
  return el("article", { className: "slot slot-game" }, children);
}

function eventSlot(event) {
  const children = [];
  if (event.room) children.push(el("p", { className: "room", text: event.room }));
  children.push(el("p", { className: "event-name", text: event.name }));
  return el("article", { className: "slot slot-event" }, children);
}

function renderHome() {
  document.title = "Clocktower by the Sea";
  const view = el("div", null, [el("h2", { text: "Timetable" })]);

  for (const day of groupedSchedule()) {
    const section = el("section", { className: "day" }, [el("h3", { text: day.day })]);
    for (const group of day.times) {
      const count = Math.min(group.items.length, 3);
      const items = el("div", { className: `time-items cols-${count}` });
      for (const item of group.items) {
        items.append(item.kind === "game" ? gameSlot(item) : eventSlot(item));
      }
      section.append(
        el("div", { className: "time-block" }, [
          el("p", { className: "time", text: formatRange(group.time, group.end) }),
          items
        ])
      );
    }
    view.append(section);
  }

  const people = el("ul", { className: "person-list" });
  const storytellers = [...convention.storytellers].sort((a, b) => a.name.localeCompare(b.name));
  for (const person of storytellers) {
    const card = el("a", { className: "person-card", href: `#/storytellers/${person.id}` }, [
      el("span", { className: "person-name", text: person.name })
    ]);
    if (person.location) card.append(el("span", { className: "person-location", text: person.location }));
    people.append(el("li", null, [card]));
  }
  view.append(el("section", { className: "storytellers" }, [el("h2", { text: "Storytellers" }), people]));
  return view;
}

function fact(term, value) {
  return el("div", null, [el("dt", { text: term }), el("dd", null, [value])]);
}

function externalIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "external-icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute(
    "d",
    "M9 2h5v5h-1.5V4.6L6.7 10.4 5.6 9.3l5.8-5.8H9V2zM3.5 4H7v1.5H5v6h6V9H12.5v3.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
  );
  svg.append(path);
  return svg;
}

function externalLink(href, text) {
  const link = el("a", { href, target: "_blank", rel: "noopener noreferrer" });
  link.append(text, externalIcon());
  link.setAttribute("aria-label", `${text}, opens in a new tab`);
  return link;
}

function scriptLinkList(game) {
  const wrap = el("span");
  game.scriptLinks.forEach((link, index) => {
    if (index > 0) wrap.append(document.createElement("br"));
    wrap.append(externalLink(link.url, link.label));
  });
  return wrap;
}

function peopleFact(label, ids) {
  const people = el("span");
  people.append(tellerLinks(ids));
  return fact(label, people);
}

function renderGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return renderMissing();

  document.title = `${game.scriptName} · Clocktower by the Sea`;
  const facts = [
    fact("Day", document.createTextNode(game.day)),
    fact("Time", document.createTextNode(formatRange(game.time, game.end)))
  ];
  if (game.room) facts.push(fact("Room", document.createTextNode(game.room)));
  if (game.scriptLinks.length) {
    facts.push(fact(game.scriptLinks.length === 1 ? "Script" : "Scripts", scriptLinkList(game)));
  } else if (game.scriptName !== "Pick Up Games") {
    facts.push(fact("Script", document.createTextNode("No script link yet.")));
  }
  if (game.storytellerIds.length) {
    facts.push(peopleFact(game.storytellerIds.length === 1 ? "Storyteller" : "Storytellers", game.storytellerIds));
  }
  if (game.grimionIds.length) {
    facts.push(peopleFact(game.grimionIds.length === 1 ? "Grimion" : "Grimions", game.grimionIds));
  }

  return el("article", null, [
    el("a", { className: "back-link", href: "#/", text: "Timetable" }),
    el("h2", { text: game.scriptName }),
    el("dl", { className: "facts" }, facts)
  ]);
}

function gameList(list) {
  const items = el("ul", { className: "game-list" });
  for (const game of list) {
    const place = game.room ? `${game.room} · ` : "";
    items.append(
      el("li", null, [
        el("a", {
          href: `#/games/${game.id}`,
          text: `${game.day}, ${formatRange(game.time, game.end)} · ${place}${game.scriptName}`
        })
      ])
    );
  }
  return items;
}

function renderStoryteller(id) {
  const person = storytellersById.get(id);
  if (!person) return renderMissing();

  document.title = `${person.name} · Clocktower by the Sea`;
  const telling = games
    .filter((game) => game.storytellerIds.includes(person.id))
    .sort(byScheduleOrder);
  const assisting = games
    .filter((game) => game.grimionIds.includes(person.id))
    .sort(byScheduleOrder);

  const children = [
    el("a", { className: "back-link", href: "#/", text: "Timetable" }),
    el("h2", { text: person.name })
  ];
  const facts = [];
  if (person.location) facts.push(fact("Location", document.createTextNode(person.location)));
  const aftergameId = (person.aftergameId || "").trim();
  if (aftergameId) {
    const href = /^https?:\/\//i.test(aftergameId)
      ? aftergameId
      : `https://aftergame.app/profile/${encodeURIComponent(aftergameId.replace(/^@/, ""))}`;
    facts.push(
      fact(
        "Aftergame ID",
        externalLink(href, aftergameId.replace(/^@/, ""))
      )
    );
  }
  if (facts.length) children.push(el("dl", { className: "facts" }, facts));
  if (person.bio) children.push(el("p", { className: "bio", text: person.bio }));

  if (!telling.length && !assisting.length) {
    children.push(el("p", { text: "No games on this schedule." }));
  }
  if (telling.length) {
    children.push(el("section", null, [
      el("h3", { text: assisting.length ? "Storyteller" : "Games" }),
      gameList(telling)
    ]));
  }
  if (assisting.length) {
    children.push(el("section", null, [el("h3", { text: "Grimion" }), gameList(assisting)]));
  }

  return el("article", null, children);
}

function renderMissing() {
  document.title = "Not found · Clocktower by the Sea";
  return el("article", null, [
    el("h2", { text: "This page is not on the schedule" }),
    el("a", { className: "back-link", href: "#/", text: "Back to the timetable" })
  ]);
}

let hasRendered = false;

function render() {
  const route = parseRoute();
  const app = document.querySelector("#app");
  const view =
    route.name === "home"
      ? renderHome()
      : route.name === "game"
        ? renderGame(route.id)
        : route.name === "storyteller"
          ? renderStoryteller(route.id)
          : renderMissing();

  app.replaceChildren(view);
  window.scrollTo(0, 0);

  if (hasRendered) {
    const heading = view.querySelector("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
  hasRendered = true;
}

window.addEventListener("hashchange", render);
render();
