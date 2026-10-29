import { createRoot } from "react-dom/client";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TeamEditor } from "../../src/components/team-editor";
import en from "../../messages/en.json";
const router: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "synthetic",
};
const team = {
  id: "synthetic-team",
  name: "Synthetic",
  capacity: 4,
  members: [],
  finalizedAt: null,
  avatarKey: null,
} as unknown as Parameters<typeof TeamEditor>[0]["team"];
function Harness() {
  const [show, setShow] = useState(true);
  return (
    <AppRouterContext.Provider value={router}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <button onClick={() => setShow(false)}>Unmount editor</button>
        {show && (
          <TeamEditor slug="synthetic" version={1} team={team} locked={false} />
        )}
      </NextIntlClientProvider>
    </AppRouterContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
