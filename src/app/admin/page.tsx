import { PageHeading } from "@/components/ui";
export default function Page() {
  return (
    <div className="container page">
      <PageHeading eyebrow="Staff access" title="Staff sign-in required">
        Administration is not available yet. Staff authorization is required to
        access applicant data.
      </PageHeading>
    </div>
  );
}
