import { Action, PageHeading } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="container page">
      <PageHeading eyebrow="404" title="Off the beat.">
        This page could not be found.
      </PageHeading>
      <Action href="/">Back to OCLR</Action>
    </div>
  );
}
