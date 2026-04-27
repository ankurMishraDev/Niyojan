import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "@/features/auth/AuthProvider";
import { RouteGuard } from "@/app/RouteGuard";

function renderGuard(contextValue: AuthContextValue, roles?: Array<"ngo_admin" | "volunteer">) {
  return render(
    <AuthContext.Provider value={contextValue}>
      <MemoryRouter initialEntries={["/secure"]}>
        <Routes>
          <Route element={<RouteGuard roles={roles} />}>
            <Route path="/secure" element={<div>secure content</div>} />
          </Route>
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RouteGuard", () => {
  const baseContext: AuthContextValue = {
    status: "authenticated",
    user: {
      id: "user-1",
      orgId: "org-1",
      firebaseUid: "firebase-user-1",
      name: "Operator",
      email: "operator@example.com",
      role: "ngo_admin",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    usingFirebase: false,
    devMockEnabled: true,
    signInWithEmail: async () => undefined,
    signInWithDevMock: async () => undefined,
    signOut: async () => undefined,
    refreshProfile: async () => undefined,
  };

  it("renders children when authenticated and authorized", () => {
    renderGuard(baseContext, ["ngo_admin"]);
    expect(screen.getByText("secure content")).toBeInTheDocument();
  });

  it("shows access denied when role is not permitted", () => {
    renderGuard(baseContext, ["volunteer"]);
    expect(screen.getByText(/outside your command scope/i)).toBeInTheDocument();
  });
});
