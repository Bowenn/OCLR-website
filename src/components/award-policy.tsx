"use client";
import { useId } from "react";
import styles from "./award-policy.module.css";
import { useAppTranslations } from "@/i18n/shared";
export function AwardPolicy() {
  const tr = useAppTranslations();
  const id = useId();
  return (
    <section className={styles.policy} aria-labelledby={id}>
      <h2 id={id}>{tr("Award policy and calculation")}</h2>
      <p>
        {tr(
          "One approved scored game is one appearance. Weekly performance is the mean of each player score divided by the highest eligible score in that game. The entire fixture belongs to the week containing its scheduled time.",
        )}
      </p>
      <p>
        {tr(
          "MVP: at least 6 appearances. MIP: from week 2, at least 5 appearances in both adjacent weeks and positive absolute improvement. Rookie: at least 5 appearances and draft-derived Tier of T4, T5 or below. Awards are independent; ties remain tied.",
        )}
      </p>
      <p className="muted small">
        {tr(
          "Ratios and weekly means are rounded half up to 9 decimal places. Unverified games require review. Only reviewed and published awards are public.",
        )}
      </p>
    </section>
  );
}
