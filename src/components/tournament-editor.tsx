"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registrationBlockers, type Edition } from "@/lib/editions";
import type { tournamentForAdmin } from "@/lib/tournaments";
import { ConfirmMutation } from "./confirm-mutation";
import { WorkspaceTabs } from "./workspace-tabs";
import { ZonedDateInput } from "./zoned-date-input";
type Workspace = Pick<
  Awaited<ReturnType<typeof tournamentForAdmin>>,
  "edition" | "revision" | "applications" | "frozen" | "readiness"
>;
type Identity = Pick<
  Edition,
  "name" | "season" | "summary" | "timeZone" | "branding"
>;
function IdentityFields({
  value,
  onChange,
}: {
  value: Identity;
  onChange: (value: Identity) => void;
}) {
  return (
    <>
      <label className="field">
        <span>Tournament name</span>
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Season identifier (optional)</span>
        <input
          maxLength={40}
          value={value.season ?? ""}
          onChange={(e) =>
            onChange({ ...value, season: e.target.value || null })
          }
        />
      </label>
      <label className="field">
        <span>Summary</span>
        <textarea
          required
          maxLength={2000}
          value={value.summary}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
        />
      </label>
      <label className="field">
        <span>IANA time zone</span>
        <input
          required
          value={value.timeZone}
          list="edition-time-zones"
          onChange={(e) => onChange({ ...value, timeZone: e.target.value })}
        />
        <datalist id="edition-time-zones">
          {["UTC", "Asia/Taipei", "Asia/Shanghai", "Asia/Hong_Kong"].map(
            (zone) => (
              <option key={zone} value={zone} />
            ),
          )}
        </datalist>
      </label>
      <fieldset className="form-stack">
        <legend>Approved artwork</legend>
        {(["logo", "background", "keyVisual"] as const).map((key, i) => (
          <label className="field" key={key}>
            <span>
              {["Square logo", "Website background", "Key visual"][i]}
            </span>
            <select
              value={value.branding[key] ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  branding: {
                    ...value.branding,
                    [key]: e.target.value || null,
                  },
                })
              }
            >
              <option value="">No edition artwork</option>
              <option
                value={
                  [
                    "/oclr-s11-square-logo.webp",
                    "/oclr-s11-website-background.webp",
                    "/oclr-s11-key-visual.webp",
                  ][i]
                }
              >
                OCLR Season 11 — {["logo", "background", "key visual"][i]}
              </option>
            </select>
          </label>
        ))}
      </fieldset>
    </>
  );
}
export function CreateTournamentForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [value, setValue] = useState<Identity>({
    name: "",
    season: null,
    summary: "",
    timeZone: "UTC",
    branding: { logo: null, background: null, keyVisual: null },
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, slug, confirmed: true }),
      });
      const data = await result.json();
      if (!result.ok) {
        setError(data.error || "Tournament could not be created.");
        return;
      }
      router.push(`/admin/tournaments/${data.edition.slug}`);
      router.refresh();
    } catch {
      setError(
        "Connection interrupted. Check the tournament list before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="panel form-stack" onSubmit={create}>
      <IdentityFields value={value} onChange={setValue} />
      <label className="field">
        <span>Permanent slug</span>
        <input
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={80}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          aria-describedby="slug-help"
        />
      </label>
      <p id="slug-help" className="muted small">
        Lowercase letters, numbers and hyphens. The tournament URL cannot be
        renamed after creation.
      </p>
      <p className="notice">
        New tournaments are private. Registration, rules and dates remain
        unconfigured.
      </p>
      {error && (
        <p role="alert" className="notice error-text">
          {error}
        </p>
      )}
      <button disabled={pending}>
        {pending ? "Creating…" : "Create tournament"}
      </button>
    </form>
  );
}
type EditorProps = { data: Workspace; saved: (message: string) => void };
function Save({
  data,
  action,
  fields,
  label,
  saved,
  confirmation = false,
  disabled = false,
}: EditorProps & {
  action: string;
  fields: Record<string, unknown>;
  label: string;
  confirmation?: boolean;
  disabled?: boolean;
}) {
  return (
    <ConfirmMutation
      requireConfirmation={confirmation}
      disabled={disabled}
      label={label}
      title={label}
      description={
        action === "registration"
          ? "Review registration availability, dates and questions. Enabling registration accepts applications only within this window and the approved prerequisites."
          : "Save the approved tournament settings."
      }
      url={`/api/admin/tournaments/${data.edition.slug}`}
      payload={{
        action,
        expectedRevision: data.revision,
        confirmed: true,
        ...fields,
      }}
      onSuccess={() => saved(`${label.replace(/^Save /, "")} saved.`)}
    />
  );
}
function General({ data, saved }: EditorProps) {
  const [value, setValue] = useState<Identity>({
    name: data.edition.name,
    season: data.edition.season,
    summary: data.edition.summary,
    timeZone: data.edition.timeZone,
    branding: data.edition.branding,
  });
  const [status, setStatus] = useState(data.edition.status);
  return (
    <section className="panel form-stack">
      <h2>General settings</h2>
      <p className="muted small tournament-slug">
        Permanent slug: <strong>{data.edition.slug}</strong>
      </p>
      <IdentityFields value={value} onChange={setValue} />
      <label className="field">
        <span>Tournament status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Edition["status"])}
        >
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <Save
        data={data}
        saved={saved}
        action="general"
        fields={{ ...value, status }}
        label="Save general settings"
        confirmation={
          status === "completed" && data.edition.status !== "completed"
        }
      />
    </section>
  );
}
function Rules({ data, saved }: EditorProps) {
  const [configured, setConfigured] = useState(Boolean(data.edition.rules));
  const [version, setVersion] = useState(data.edition.rules?.version ?? "");
  const [sections, setSections] = useState(
    data.edition.rules?.sections ?? [{ heading: "", body: "" }],
  );
  const [eligibility, setEligibility] = useState(
    data.edition.eligibility ?? "",
  );
  return (
    <section className="panel form-stack">
      <h2>Rules & eligibility</h2>
      <p className="muted small">
        Rules and eligibility are optional. Changed rules use a new version;
        existing applications keep their original acknowledgment and snapshot.
      </p>
      {
        <label className="check-field">
          <input
            type="checkbox"
            checked={configured}
            onChange={(e) => setConfigured(e.target.checked)}
          />
          <span>Configure approved rules</span>
        </label>
      }
      {configured && (
        <>
          <details open={!data.edition.rules}>
            <summary>Rules release</summary>
            <p className="small muted">
              This is the published identifier players acknowledge. Use a new
              identifier when rules change; past acknowledgments remain attached
              to the original release.
            </p>
            <label className="field">
              <span>Rules version</span>
              <input
                value={version}
                maxLength={80}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
          </details>
          {sections.map((s, i) => (
            <fieldset className="form-stack" key={i}>
              <legend>Rules section {i + 1}</legend>
              <label className="field">
                <span>Section {i + 1} heading</span>
                <input
                  maxLength={200}
                  value={s.heading}
                  onChange={(e) =>
                    setSections(
                      sections.map((v, j) =>
                        i === j ? { ...v, heading: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Section {i + 1} content</span>
                <textarea
                  rows={6}
                  maxLength={20000}
                  value={s.body}
                  onChange={(e) =>
                    setSections(
                      sections.map((v, j) =>
                        i === j ? { ...v, body: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!i}
                  onClick={() =>
                    setSections(
                      sections.map((v, j) =>
                        j === i - 1
                          ? sections[i]
                          : j === i
                            ? sections[i - 1]
                            : v,
                      ),
                    )
                  }
                >
                  Move section {i + 1} up
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={sections.length === 1}
                  onClick={() =>
                    setSections(sections.filter((_, j) => j !== i))
                  }
                >
                  Remove section {i + 1}
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={sections.length >= 32}
            onClick={() =>
              setSections([...sections, { heading: "", body: "" }])
            }
          >
            Add rules section
          </button>
        </>
      )}
      <label className="field">
        <span>Eligibility disclosure</span>
        <textarea
          rows={5}
          maxLength={4000}
          value={eligibility}
          onChange={(e) => setEligibility(e.target.value)}
        />
      </label>
      <Save
        data={data}
        saved={saved}
        action="rules"
        fields={{
          rules: configured ? { version, sections } : null,
          eligibility: eligibility.trim() || null,
        }}
        label="Save rules & eligibility"
      />
    </section>
  );
}
function Registration({ data, saved }: EditorProps) {
  const e = data.edition;
  const [configured, setConfigured] = useState(Boolean(e.registration));
  const [enabled, setEnabled] = useState(e.registration?.enabled ?? false);
  const [opensAt, setOpens] = useState<string | null>(
    e.registration?.opensAt ?? null,
  );
  const [closesAt, setCloses] = useState<string | null>(
    e.registration?.closesAt ?? null,
  );
  const [withdrawUntil, setWithdraw] = useState<string | null>(
    e.registration?.withdrawUntil ?? null,
  );
  const [opensValid, setOpensValid] = useState(Boolean(opensAt));
  const [closesValid, setClosesValid] = useState(Boolean(closesAt));
  const [withdrawValid, setWithdrawValid] = useState(true);
  const [questions, setQuestions] = useState(e.registration?.questions ?? []);
  const blockers = registrationBlockers(
    e,
    data.readiness.some(
      (item) => item.label === "Privacy configuration" && item.ready,
    ),
  );

  return (
    <section className="panel form-stack">
      <h2>Registration settings</h2>
      <p className="muted small">
        Publication and entry availability are separate. Configure dates with
        registration paused, then explicitly enable it after the prerequisites
        are ready.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={configured}
          onChange={(e) => setConfigured(e.target.checked)}
        />
        <span>Configure registration window</span>
      </label>
      {configured && (
        <>
          <ZonedDateInput
            label="Registration opens"
            value={opensAt}
            timeZone={e.timeZone}
            onChange={setOpens}
            onValidityChange={setOpensValid}
          />
          <ZonedDateInput
            label="Registration closes"
            value={closesAt}
            timeZone={e.timeZone}
            onChange={setCloses}
            onValidityChange={setClosesValid}
          />
          <ZonedDateInput
            label="Withdrawal deadline"
            value={withdrawUntil}
            timeZone={e.timeZone}
            onChange={setWithdraw}
            onValidityChange={setWithdrawValid}
            optional
          />
          {blockers.length > 0 && (
            <aside className="registration-blockers">
              <strong>Before enabling registration</strong>
              <ul>
                {blockers.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </aside>
          )}
          <p className="muted small">
            Enable in advance to open automatically. Submissions are accepted
            only between the opening and closing times, in {e.timeZone}.
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!enabled && blockers.length > 0}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable registration during this window</span>
          </label>
          <h3>Application questions</h3>
          <p className="muted small">
            Collect only necessary information. Existing applications retain
            their original questions and answers when you edit this form.
          </p>
          {questions.map((q, i) => (
            <fieldset className="form-stack" key={q.id}>
              <legend>Question {i + 1}</legend>
              <label className="field">
                <span>Question {i + 1} label</span>
                <input
                  maxLength={200}
                  value={q.label}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((v, j) =>
                        j === i ? { ...v, label: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((v, j) =>
                        j === i ? { ...v, required: e.target.checked } : v,
                      ),
                    )
                  }
                />
                <span>Question {i + 1} is required</span>
              </label>
              <label className="field">
                <span>Question {i + 1} maximum length</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={q.maxLength}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((v, j) =>
                        j === i
                          ? { ...v, maxLength: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!i}
                  onClick={() =>
                    setQuestions(
                      questions.map((v, j) =>
                        j === i - 1
                          ? questions[i]
                          : j === i
                            ? questions[i - 1]
                            : v,
                      ),
                    )
                  }
                >
                  Move question {i + 1} up
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setQuestions(questions.filter((_, j) => j !== i))
                  }
                >
                  Remove question {i + 1}
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={questions.length >= 16}
            onClick={() =>
              setQuestions([
                ...questions,
                {
                  id: `question_${crypto.randomUUID().slice(0, 8)}`,
                  label: "",
                  required: false,
                  maxLength: 500,
                },
              ])
            }
          >
            Add question
          </button>
        </>
      )}
      <Save
        data={data}
        saved={saved}
        action="registration"
        fields={{
          registration: configured
            ? { enabled, opensAt, closesAt, withdrawUntil, questions }
            : null,
        }}
        label="Save registration settings"
        disabled={
          configured &&
          (!opensValid ||
            !closesValid ||
            !withdrawValid ||
            (enabled && blockers.length > 0))
        }
      />
    </section>
  );
}
function Schedule({ data, saved }: EditorProps) {
  const [schedule, setSchedule] = useState(
    data.edition.schedule.map((s, id) => ({ ...s, id })),
  );
  const nextId = useRef(schedule.length);
  const [invalid, setInvalid] = useState<Record<number, boolean>>({});
  return (
    <section className="panel form-stack">
      <h2>Tournament milestones</h2>
      <p className="muted small">
        Milestones are separate from match fixtures. Leave unconfirmed dates
        blank for TBA.
      </p>
      {schedule.map((s, i) => (
        <fieldset key={s.id} className="form-stack">
          <legend>Milestone {i + 1}</legend>
          <label className="field">
            <span>Milestone {i + 1} label</span>
            <input
              maxLength={200}
              value={s.label}
              onChange={(e) =>
                setSchedule(
                  schedule.map((v, j) =>
                    j === i ? { ...v, label: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <ZonedDateInput
            label={`Milestone ${i + 1} time`}
            onValidityChange={(valid) =>
              setInvalid((old) =>
                old[s.id] === !valid ? old : { ...old, [s.id]: !valid },
              )
            }
            value={s.at}
            timeZone={data.edition.timeZone}
            optional
            onChange={(at) =>
              setSchedule(schedule.map((v, j) => (j === i ? { ...v, at } : v)))
            }
          />
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={!i}
              onClick={() =>
                setSchedule(
                  schedule.map((v, j) =>
                    j === i - 1 ? schedule[i] : j === i ? schedule[i - 1] : v,
                  ),
                )
              }
            >
              Move milestone {i + 1} up
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSchedule(schedule.filter((_, j) => i !== j))}
            >
              Remove milestone {i + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={schedule.length >= 64}
        onClick={() =>
          setSchedule([
            ...schedule,
            { label: "", at: null, id: nextId.current++ },
          ])
        }
      >
        Add milestone
      </button>
      <Save
        data={data}
        saved={saved}
        action="schedule"
        fields={{ schedule: schedule.map(({ label, at }) => ({ label, at })) }}
        disabled={schedule.some((s) => invalid[s.id])}
        label="Save milestones"
      />
    </section>
  );
}
function Publication({ data, saved }: EditorProps) {
  return (
    <section className="panel form-stack">
      <h2>Publication</h2>
      <p className="notice">
        {data.edition.published
          ? "Unpublishing hides tournament information and pauses registration. Existing competition records are preserved."
          : "Publishing makes approved information public. Registration stays paused until explicitly enabled in Registration settings."}
      </p>
      <ConfirmMutation
        label={
          data.edition.published ? "Unpublish tournament" : "Publish tournament"
        }
        title={
          data.edition.published
            ? "Hide this tournament?"
            : "Publish this tournament?"
        }
        description="Review tournament identity, public wording and the effect on visibility before confirming."
        url={`/api/admin/tournaments/${data.edition.slug}`}
        payload={{
          action: "publication",
          expectedRevision: data.revision,
          confirmed: true,
          published: !data.edition.published,
        }}
        onSuccess={() => {
          saved("Publication updated.");
        }}
      />
      <p className="muted small">
        Historical tournaments are retained. Mark an edition Completed in
        General settings; use visibility controls to archive it privately.
      </p>
    </section>
  );
}
export function TournamentEditor({ data }: { data: Workspace }) {
  const id = useId();
  const router = useRouter();
  const requested = useSearchParams().get("section");
  const section =
    requested &&
    ["general", "registration", "rules", "schedule", "publication"].includes(
      requested,
    )
      ? requested
      : "general";
  const [message, setMessage] = useState("");
  const props = { data, saved: setMessage };
  return (
    <div className="tournament-settings">
      <WorkspaceTabs
        id={id}
        label="Tournament settings"
        value={section}
        items={[
          { value: "general", label: "General" },
          { value: "registration", label: "Registration" },
          { value: "rules", label: "Rules & eligibility" },
          { value: "schedule", label: "Milestones" },
          { value: "publication", label: "Publication" },
        ]}
        onChange={(next) => {
          router.replace(
            `/admin/tournaments/${data.edition.slug}/settings?section=${next}`,
            { scroll: false },
          );
          setMessage("");
        }}
      />
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${section}`}
        tabIndex={0}
      >
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {data.frozen &&
          ["rules", "registration", "schedule"].includes(section) && (
            <p className="notice">
              These settings are frozen after setup locks or drafting begins.
              Existing registrations and competition history are retained.
            </p>
          )}
        {section === "general" && (
          <General
            key={JSON.stringify({
              name: data.edition.name,
              summary: data.edition.summary,
              status: data.edition.status,
              season: data.edition.season,
              timeZone: data.edition.timeZone,
              branding: data.edition.branding,
            })}
            {...props}
          />
        )}
        {!data.frozen && section === "registration" && (
          <Registration
            key={JSON.stringify(data.edition.registration)}
            {...props}
          />
        )}
        {!data.frozen && section === "rules" && (
          <Rules
            key={JSON.stringify([data.edition.rules, data.edition.eligibility])}
            {...props}
          />
        )}
        {!data.frozen && section === "schedule" && (
          <Schedule key={JSON.stringify(data.edition.schedule)} {...props} />
        )}
        {section === "publication" && (
          <Publication key={String(data.edition.published)} {...props} />
        )}
      </div>
    </div>
  );
}
