import { lazy } from "react";
import OwnerLocale from "../components/owner/OwnerLocale";
import RequireOwner from "../components/owner/RequireOwner";

const OwnerDashboard = lazy(() => import("../pages/OwnerDashboard"));
const OwnerLogin = lazy(() => import("../pages/OwnerLogin"));

export default function OwnerRoute({ dashboard = false }) {
  return (
    <OwnerLocale>
      {dashboard ? (
        <RequireOwner>
          <OwnerDashboard />
        </RequireOwner>
      ) : (
        <OwnerLogin />
      )}
    </OwnerLocale>
  );
}
