"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  type ComponentProps,
} from "react";

export const StaffReadOnlyContext = createContext(false);
export function useStaffReadOnly() {
  return useContext(StaffReadOnlyContext);
}
/** Only wrap mutation fields, leaving navigation, search and history interactive. */
export function ReadOnlyFields({ children }: { children: ReactNode }) {
  const readOnly = useStaffReadOnly();
  return (
    <fieldset className="staff-readonly-fields" disabled={readOnly}>
      {children}
    </fieldset>
  );
}
export function MutationButton(props: ComponentProps<"button">) {
  const readOnly = useStaffReadOnly();
  return <button {...props} disabled={readOnly || props.disabled} />;
}
