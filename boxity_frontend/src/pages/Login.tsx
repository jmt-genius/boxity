import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import type { UserRole } from "@/types";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSocial, loginWithPasswordless, loginWithRedirect, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [passwordlessEmail, setPasswordlessEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const roles: UserRole[] = ["MANUFACTURER", "DISTRIBUTOR", "WAREHOUSE", "DELIVERY_PERSON"];

  // Check for error in location state
  useEffect(() => {
    if (location.state?.error) {
      setErrorMessage(location.state.error);
      // Clear the error from state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isAuthenticated && !isLoading) {
    return null;
  }

  const handleSocialLogin = async (connection: "google-oauth2" | "apple") => {
    if (!selectedRole) {
      alert("Please select your role first");
      return;
    }

    // Store selected role
    if (selectedRole) {
      localStorage.setItem("boxity_selected_role", selectedRole);
    }

    setIsSubmitting(true);
    try {
      // Auth0 will redirect, so we don't need to navigate manually
      await loginWithSocial(connection, activeTab === "signup");
    } catch (error: any) {
      console.error("Social login failed:", error);
      setIsSubmitting(false);
      alert(error.message || "Login failed. Please try again.");
    }
  };

  const handlePasswordlessEmail = async () => {
    if (!passwordlessEmail || !selectedRole) {
      alert("Please enter your email and select your role");
      return;
    }

    // Store selected role in localStorage for after redirect
    if (selectedRole) {
      localStorage.setItem("boxity_selected_role", selectedRole);
    }

    setIsSubmitting(true);
    try {
      // Auth0 passwordless will redirect to Auth0, then back to our app
      await loginWithPasswordless(passwordlessEmail, activeTab === "signup");
    } catch (error: any) {
      console.error("Passwordless login failed:", error);
      setIsSubmitting(false);
      
      // Check for specific Auth0 errors
      if (error.error === 'invalid_request' || error.message?.includes('connection') || error.message?.includes('not enabled')) {
        setErrorMessage(
          "Passwordless email connection is not enabled. Please enable it in Auth0 Dashboard: Applications → My App → Connections → Enable 'Email (Passwordless)'"
        );
      } else if (error.message?.includes('email') || error.message?.includes('sending') || error.error_description?.includes('email')) {
        setErrorMessage(
          "Auth0 email service is not configured. Please configure email sending in Auth0 Dashboard: Branding → Email Provider → Set up SMTP or use Auth0 Email Service. See FIX_AUTH0_EMAIL_SENDING.md for details."
        );
      } else {
        setErrorMessage(error.message || "Failed to initiate login. Please try again.");
      }
    }
  };


  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedRole) {
      alert("Please enter your email and select your role");
      return;
    }

    // Store selected role
    if (selectedRole) {
      localStorage.setItem("boxity_selected_role", selectedRole);
    }

    setIsSubmitting(true);
    try {
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE && import.meta.env.VITE_AUTH0_AUDIENCE.trim() !== ''
        ? import.meta.env.VITE_AUTH0_AUDIENCE
        : undefined;
      // Use Auth0's database connection for email/password
      await loginWithRedirect({
        authorizationParams: {
          connection: "Username-Password-Authentication",
          login_hint: email,
          ...(audience && { audience }),
          scope: "openid profile email offline_access",
          ...(activeTab === "signup" && { screen_hint: "signup" }),
        },
        appState: {
          returnTo: window.location.origin,
        },
      });
    } catch (error: any) {
      console.error("Email login failed:", error);
      setIsSubmitting(false);
      alert(error.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Welcome to Boxity</CardTitle>
          <CardDescription className="text-center">
            Supply Chain Verification Platform
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
                Log In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Select Your Role
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={selectedRole === role ? "default" : "outline"}
                      className={`w-full ${
                        selectedRole === role
                          ? "bg-orange-500 hover:bg-orange-600 text-white"
                          : ""
                      }`}
                      onClick={() => setSelectedRole(role)}
                    >
                      {role.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                  onClick={() => handleSocialLogin("google-oauth2")}
                  disabled={!selectedRole || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Sign in with Google
                </Button>

                {navigator.userAgent.includes("Mac") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-[#007AFF] hover:bg-[#0051D5] text-white border-[#007AFF]"
                    onClick={() => handleSocialLogin("apple")}
                    disabled={!selectedRole || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                      </svg>
                    )}
                    Sign in with Apple
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">or</span>
                </div>
              </div>

              {/* Passwordless Login - Continue with Email */}
              <form onSubmit={(e) => { e.preventDefault(); handlePasswordlessEmail(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="passwordless-email" className="text-sm font-semibold">
                    Continue with Email
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    We'll send you a magic link or verification code to sign in
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="passwordless-email"
                      type="email"
                      placeholder="your@email.com"
                      value={passwordlessEmail}
                      onChange={(e) => setPasswordlessEmail(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!selectedRole || !passwordlessEmail || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Continue with Email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Traditional Email/Password (Optional - for Auth0 database connection) */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">or</span>
                </div>
              </div>

              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="yours@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-orange-500 hover:underline"
                      onClick={() => {
                        // Trigger Auth0 password reset
                        window.location.href = `https://${import.meta.env.VITE_AUTH0_DOMAIN}/v2/logout?returnTo=${encodeURIComponent(window.location.origin + "/login")}`;
                      }}
                    >
                      Don't remember your password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="your password"
                      className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!selectedRole || !email || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      LOG IN
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              {/* Sign Up uses same flow but with signup connection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Select Your Role
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={selectedRole === role ? "default" : "outline"}
                      className={`w-full ${
                        selectedRole === role
                          ? "bg-orange-500 hover:bg-orange-600 text-white"
                          : ""
                      }`}
                      onClick={() => setSelectedRole(role)}
                    >
                      {role.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                  onClick={() => handleSocialLogin("google-oauth2")}
                  disabled={!selectedRole || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Sign up with Google
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">or</span>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handlePasswordlessEmail(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-semibold">
                    Continue with Email
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    We'll send you a magic link or verification code to create your account
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={passwordlessEmail}
                      onChange={(e) => setPasswordlessEmail(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!selectedRole || !passwordlessEmail || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Continue with Email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

