// Local reference interaction only. No preference cookies, storage, APIs or auth.
const root = document.documentElement;
const modes = [...document.querySelectorAll("[data-mode]")];
function setMode(mode) {
  root.dataset.theme = mode;
  modes.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode)),
  );
}
const mode = new URLSearchParams(location.search).get("theme");
setMode(mode === "dark" ? "dark" : "light");
modes.forEach((button) =>
  button.addEventListener("click", () => setMode(button.dataset.mode)),
);
document.querySelectorAll(".sample-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".sample-tabs button").forEach((other) => {
      other.setAttribute("aria-pressed", String(other === button));
    });
    document.querySelector(".map-slot-badge").textContent =
      `${button.textContent}2`;
  });
});
const form = document.querySelector("form");
document.querySelector("[data-preview]").addEventListener("click", () => {
  form.querySelector("output").textContent =
    "Sample action complete. Nothing was saved.";
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  form.querySelector("output").textContent =
    "Sample preview complete. Nothing was saved.";
});
form.addEventListener("reset", () => {
  form.querySelector("output").textContent = "";
});
