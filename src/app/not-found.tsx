import { useAppTranslations } from "@/i18n/shared";
import { Action, PageHeading } from "@/components/ui";
export default function NotFound() {
  const tr = useAppTranslations();

  return (
    <div className="container page">
      <PageHeading eyebrow="404" title={tr("Off the beat.")}>
        {tr("This page could not be found.")}
      </PageHeading>
      <Action href="/">{tr("Back to OCLR")}</Action>
    </div>
  );
}
