// Static review artifact: local interactions only; no cookies, storage or APIs.
const sample = JSON.parse(document.querySelector("#sample-data").textContent);
const root = document.documentElement;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const matchRows = sample.matches
  .map(
    (match) => `
  <article class="match-row" aria-label="${escape(match.label)}">
    <div class="match-time">${escape(match.date)}<strong>${escape(match.time)}</strong>UTC+8</div>
    <div class="teams">${match.teams.map((name, i) => `<div class="team-row ${match.score[i] > match.score[1 - i] ? "winner" : ""}"><span>${escape(name)}</span><strong class="score">${match.score[i]}</strong></div>`).join("")}</div>
    <a class="match-link" href="${escape(match.url)}" target="_blank" rel="noreferrer" aria-label="View match ${escape(match.label)} on osu!">MP ↗</a>
  </article>`,
  )
  .join("");
const mapRows = sample.maps
  .map(
    (map) => `
  <div class="map-row">
    <span class="slot">${escape(map.slot)}</span>
    <div><a class="map-title" href="https://osu.ppy.sh/beatmaps/${map.beatmapId}" target="_blank" rel="noreferrer">${escape(map.title)}</a><div class="mapper">${escape(map.mapper)}</div></div>
    <span class="stars">${Number(map.stars).toFixed(2)} ★</span>
  </div>`,
  )
  .join("");

document.querySelector("#sample-root").innerHTML = `
  <a class="skip button primary" href="#content">Skip to content</a>
  <div class="review-bar"><div class="wrap"><span>THEME SAMPLE · 設計提案，非正式介面</span><nav class="season-links" aria-label="Design samples">${["s10", "s9", "s8", "s7"].map((s) => `<a href="${s}.html" ${s === sample.season ? 'aria-current="page"' : ""}>${s.toUpperCase()}</a>`).join("")}</nav></div></div>
  <header class="site-header"><div class="wrap header-inner"><a class="brand" href="${sample.season}.html"><span class="wordmark">OCLR<span aria-hidden="true">.</span></span><span class="brand-caption">osu! Chinese League Rookie</span></a><div class="header-tools"><div class="mode-switch" role="group" aria-label="Theme"><button type="button" data-mode="light" aria-pressed="true">Light</button><button type="button" data-mode="dark" aria-pressed="false">Dark</button></div></div></div></header>
  <main id="content">
    <section class="hero" aria-labelledby="season-title"><div class="wrap hero-inner">
      <div class="hero-heading"><div><div class="eyebrow">osu! Chinese League Rookie</div><h1 id="season-title">OCLR Season ${sample.number}</h1></div><div class="hero-meta">${escape(sample.period)}<br><span class="status">Historical seasons</span></div></div>
      <div class="hero-summary"><div class="eyebrow">${escape(sample.direction)}</div><p>歷屆賽事、對局與圖池。<br>從這裡，回到 Season ${sample.number}。</p><a class="button primary" href="#competition">View matches <span aria-hidden="true">↗</span></a></div>
      <figure class="artwork"><img src="../../../public/archive/${sample.art}" width="${sample.width}" height="${sample.height}" alt="OCLR Season ${sample.number} original artwork"><figcaption>原始主視覺 · 完整比例保留</figcaption></figure>
    </div></section>
    <div class="wrap page-body" id="competition">
      <div class="page-tabs" role="tablist" aria-label="Sample surfaces"><button id="tab-overview" role="tab" aria-selected="true" aria-controls="panel-overview" tabindex="0">Overview</button><button id="tab-schedule" role="tab" aria-selected="false" aria-controls="panel-schedule" tabindex="-1">Schedule</button><button id="tab-mappools" role="tab" aria-selected="false" aria-controls="panel-mappools" tabindex="-1">Mappools</button><button id="tab-settings" role="tab" aria-selected="false" aria-controls="panel-settings" tabindex="-1">Admin sample</button></div>
      <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
        <div class="content-grid"><div><section><div class="section-heading"><h2>Match results</h2><span class="muted">${escape(sample.matches[0].stage)}</span></div>${matchRows}</section><section class="pool-section"><div class="section-heading"><h2>Mappools</h2><a href="#panel-mappools" data-open="mappools">View mappool →</a></div>${mapRows}</section></div><aside class="season-detail"><h2>Season ${sample.number}</h2><dl><div><dt>Teams</dt><dd>${sample.teams}</dd></div><div><dt>Mappools</dt><dd>${sample.pools}</dd></div><div><dt>Time zone</dt><dd>UTC+8</dd></div><div><dt>Status</dt><dd>Completed</dd></div></dl><p class="source-note">離線歸檔快照節錄；不代表正式站發佈狀態。比賽、隊名與譜面文字均保留原資料。</p></aside></div>
      </div>
      <div id="panel-schedule" role="tabpanel" aria-labelledby="tab-schedule" tabindex="0" hidden><div class="section-heading"><h2>Match results</h2><span class="status">Completed</span></div>${matchRows}<p class="source-note">節錄自 ${sample.season}-archive.json；時間顯示為原表 UTC+8。</p></div>
      <div id="panel-mappools" role="tabpanel" aria-labelledby="tab-mappools" tabindex="0" hidden><div class="section-heading"><h2>${escape(sample.poolName)}</h2><span class="muted">3-map excerpt</span></div>${mapRows}<p class="source-note">保留原始譜面名稱與歷史星數，無即時 API 查詢。</p></div>
      <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" tabindex="0" hidden><form class="settings-form"><div class="eyebrow">Component specimen</div><h2>Tournament settings</h2><p>僅預覽表單樣式；不連接正式管理功能。</p><label class="field">Tournament name<input name="name" value="OCLR Season ${sample.number}" required maxlength="120"></label><label class="field">Default appearance<select name="appearance"><option>${escape(sample.direction)} — sample</option><option>Use site default</option></select></label><div class="actions"><button class="primary" type="submit">Preview changes</button><button type="reset">Reset</button><button type="button" disabled>Unavailable</button><output aria-live="polite"></output></div></form></div>
      <p class="source-note">Design sample · Offline archive excerpt · Not a live tournament page</p>
    </div>
    <section class="design-notes" aria-labelledby="design-title"><div class="wrap design-grid"><div><div class="eyebrow">${sample.season.toUpperCase()} / ${escape(sample.direction)}</div><h2 id="design-title">${escape(sample.chineseName)}</h2><p>${escape(sample.thesis)}</p><div class="palette">${sample.swatches.map((s) => `<div><div class="swatch" style="background:${s[1]}"></div><div class="swatch-label">${escape(s[0])}<br>${s[1].toUpperCase()}</div></div>`).join("")}</div><p class="source-note">主視覺色票（固定參考）；介面明暗語意色隨上方切換。</p></div><div><div class="eyebrow">Type & rhythm</div><div class="type-sample">清晰閱讀，保留賽季個性。<span>osu! Chinese League Rookie — Season ${sample.number}</span></div><p>${escape(sample.geometry)}</p><div class="specs"><span>Space 4 / 8 / 12 / 16 / 24 / 32 / 48</span><span>Body 16px · 1.65</span><span>Touch ≥ 44px</span></div></div></div></section>
  </main><footer><div class="wrap"><span>osu! Chinese League Rookie (OCLR)</span><span>Theme concept · 2026-10-24 · Review before implementation</span></div></footer>`;

function setMode(mode) {
  root.dataset.theme = mode;
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode)),
    );
}
document
  .querySelectorAll("[data-mode]")
  .forEach((button) =>
    button.addEventListener("click", () => setMode(button.dataset.mode)),
  );
const queryMode = new URLSearchParams(location.search).get("theme");
setMode(queryMode === "dark" ? "dark" : "light");
const tabs = [...document.querySelectorAll('[role="tab"]')];
function openTab(name, focus = false) {
  tabs.forEach((tab) => {
    const selected = tab.id === `tab-${name}`;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden =
      !selected;
    if (selected && focus) tab.focus();
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => openTab(tab.id.slice(4)));
  tab.addEventListener("keydown", (event) => {
    const n =
      event.key === "ArrowRight"
        ? (i + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (i + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (n >= 0) {
      event.preventDefault();
      openTab(tabs[n].id.slice(4), true);
    }
  });
});
document.querySelector("[data-open]").addEventListener("click", (event) => {
  event.preventDefault();
  openTab("mappools", true);
});
const form = document.querySelector("form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  form.querySelector("output").textContent = "樣式預覽完成；沒有儲存任何設定。";
});
form.addEventListener("reset", () => {
  form.querySelector("output").textContent = "";
});
