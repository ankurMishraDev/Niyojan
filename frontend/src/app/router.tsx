import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { RouteGuard } from "@/app/RouteGuard";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { AccountStatusPage } from "@/pages/AccountStatusPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { AiReviewIndexPage, AiReviewPage } from "@/pages/AiReviewPage";
import { FormBuilderPage } from "@/pages/FormBuilderPage";
import { SurveyNewPage, SurveyDetailPage } from "@/pages/SurveyPages";
import { MatchingPage } from "@/pages/MatchingPage";
import { AssignmentsPage } from "@/pages/AssignmentsPage";
import { FeedbackIndexPage, FeedbackPage } from "@/pages/FeedbackPage";
import { ProfilePage } from "@/pages/ProfilePage";

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
    path: "/",
    element: <RouteGuard />,
    children: [
      { path: "account-status", element: <AccountStatusPage /> },
      {
        element: <AppShell />,
        children: [
          { path: "app", element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "pipeline", element: <PipelinePage /> },
          { path: "ai-review", element: <AiReviewIndexPage /> },
          { path: "ai-review/:documentId", element: <AiReviewPage /> },
          { path: "form-builder", element: <FormBuilderPage /> },
          { path: "surveys/new", element: <SurveyNewPage /> },
          { path: "surveys/:surveyId", element: <SurveyDetailPage /> },
          { path: "matching", element: <MatchingPage /> },
          { path: "assignments", element: <AssignmentsPage /> },
          { path: "feedback", element: <FeedbackIndexPage /> },
          { path: "feedback/assignments/:assignmentId", element: <FeedbackPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
