import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { RouteGuard } from "@/app/RouteGuard";
import { useAuth } from "@/features/auth/useAuth";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { VolunteerSignupPage } from "@/pages/VolunteerSignupPage";
import { AccountStatusPage } from "@/pages/AccountStatusPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { AiReviewIndexPage, AiReviewPage } from "@/pages/AiReviewPage";
import { FormBuilderPage } from "@/pages/FormBuilderPage";
import { SurveyNewPage, SurveyDetailPage } from "@/pages/SurveyPages";
import { MatchingPage } from "@/pages/MatchingPage";
import { AssignmentsPage } from "@/pages/AssignmentsPage";
import { FeedbackIndexPage, FeedbackPage } from "@/pages/FeedbackPage";
import { HelpPage } from "@/pages/HelpPage";
import { ProfilePage } from "@/pages/ProfilePage";

function AppRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "volunteer" ? "/assignments" : "/dashboard"} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/volunteer-signup",
    element: <VolunteerSignupPage />,
  },
  {
    path: "/",
    element: <RouteGuard />,
    children: [
      { path: "account-status", element: <AccountStatusPage /> },
      {
        element: <AppShell />,
        children: [
          { path: "app", element: <AppRedirect /> },
          {
            element: <RouteGuard roles={["superadmin", "ngo_admin", "field_worker"]} />,
            children: [{ path: "dashboard", element: <DashboardPage /> }],
          },
          {
            element: <RouteGuard roles={["superadmin", "volunteer"]} />,
            children: [
              { path: "assignments", element: <AssignmentsPage /> },
            ],
          },
          {
            element: <RouteGuard roles={["superadmin"]} />,
            children: [
              { path: "pipeline", element: <PipelinePage /> },
              { path: "ai-review", element: <AiReviewIndexPage /> },
              { path: "ai-review/:documentId", element: <AiReviewPage /> },
              { path: "ai-review/surveys/:surveyId", element: <AiReviewPage /> },
              { path: "matching", element: <MatchingPage /> },
            ],
          },
          {
            element: <RouteGuard roles={["ngo_admin", "field_worker"]} />,
            children: [
              { path: "form-builder", element: <FormBuilderPage /> },
              { path: "surveys/new", element: <SurveyNewPage /> },
              { path: "surveys/:surveyId", element: <SurveyDetailPage /> },
            ],
          },
          {
            element: <RouteGuard roles={["superadmin", "ngo_admin", "field_worker", "volunteer"]} />,
            children: [
              { path: "feedback", element: <FeedbackIndexPage /> },
              { path: "feedback/assignments/:assignmentId", element: <FeedbackPage /> },
              { path: "help", element: <HelpPage /> },
              { path: "profile", element: <ProfilePage /> },
            ],
          },
        ],
      },
    ],
  },
]);
