import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { loginSchema, registerSchema, type LoginData, type RegisterData } from "@shared/schema";
import { securityMonitor, initializeSecurityMonitoring } from "../lib/securityMonitor";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, register } = useAuth();

  // Separate state for username to fix the binding issue
  const [usernameValue, setUsernameValue] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const monitor = initializeSecurityMonitoring();
      monitor.startMonitoring().catch(error => {
        console.warn('Failed to start security monitoring:', error);
      });
    } catch (error) {
      console.warn('Failed to initialize security monitoring:', error);
    }
  }, []);


  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
    mode: "onChange",
    shouldFocusError: true,
    criteriaMode: "all",
  });


  const handleLogin = async (data: LoginData) => {
    try {
      await login.mutateAsync(data);
      localStorage.setItem('lastLoginEmail', data.email); // Store email for biometric login
      toast({
        title: "Success",
        description: "Welcome back!",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed. Please try again.",
        variant: "destructive",
      });
    }
  };

  

  // Username availability check function
  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");

    try {
      const response = await fetch(`/api/auth/check-username/${username}`);
      const data = await response.json();

      if (data.available) {
        setUsernameStatus("available");
      } else {
        setUsernameStatus("taken");
      }
    } catch (error) {
      setUsernameStatus("idle");
    }
  };

  const handleRegister = async (data: RegisterData) => {
    try {
      // Ensure username is included in the data
      const registerData = { ...data, username: usernameValue };
      await register.mutateAsync(registerData);

      // Store email for future use
      localStorage.setItem('lastLoginEmail', data.email);

      securityMonitor.logSecurityEvent({
        type: 'login_attempt',
        severity: 'low',
        details: {
          action: 'account_created',
          enhanced_security: true
        }
      });

      toast({
        title: "🛡️ Ultra-secure account created!",
        description: "You now have military-grade encryption protection.",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Registration failed. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4">
            <Shield />
          </div>
          <CardTitle className="text-2xl">UltraSecure Messenger</CardTitle>
          <CardDescription>
            {isLogin
              ? "Sign in to access your secure messages"
              : "Create your account to get started"
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLogin ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                          data-testid="input-email"
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                            data-testid="input-password"
                            className="h-12 text-base pr-12"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base"
                  disabled={login.isPending}
                  data-testid="button-login"
                >
                  {login.isPending ? "Signing in..." : "Sign in"}
                </Button>

                
              </form>
            </Form>
          ) : (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={registerForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            {...field}
                            data-testid="input-first-name"
                            className="h-12 text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Doe"
                            {...field}
                            data-testid="input-last-name"
                            className="h-12 text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      placeholder="johndoe"
                      value={usernameValue}
                      onChange={(e) => {
                        let filtered = e.target.value;

                        // Remove all characters that are not letters, numbers, or underscores
                        filtered = filtered.replace(/[^a-zA-Z0-9_]/g, '');

                        // If it starts with a number or underscore, remove all leading numbers and underscores
                        filtered = filtered.replace(/^[0-9_]+/, '');

                        // Remove consecutive underscores (replace multiple underscores with single one)
                        filtered = filtered.replace(/_+/g, '_');

                        setUsernameValue(filtered);
                        registerForm.setValue("username", filtered, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true
                        });

                        // Clear previous timeout
                        if (usernameCheckTimeout) {
                          clearTimeout(usernameCheckTimeout);
                        }

                        // Set new timeout for username check (debouncing)
                        if (filtered.length >= 3) {
                          const newTimeout = setTimeout(() => {
                            checkUsernameAvailability(filtered);
                          }, 500);
                          setUsernameCheckTimeout(newTimeout);
                        } else {
                          setUsernameStatus("idle");
                        }
                      }}
                      data-testid="input-username"
                      className={`h-12 text-base pr-12 ${
                        usernameStatus === "taken"
                          ? "border-destructive focus:border-destructive"
                          : usernameStatus === "available"
                          ? "border-green-500 focus:border-green-500"
                          : ""
                      }`}
                    />
                    {usernameValue.length >= 3 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === "checking" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {usernameStatus === "available" && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {usernameStatus === "taken" && (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    )}
                  </div>
                  {registerForm.formState.errors.username && (
                    <p className="text-sm font-medium text-destructive">
                      {registerForm.formState.errors.username?.message}
                    </p>
                  )}
                  {usernameStatus === "taken" && (
                    <p className="text-sm font-medium text-destructive">
                      This username is already taken
                    </p>
                  )}
                  {usernameStatus === "available" && (
                    <p className="text-sm font-medium text-green-600">
                      Username is available
                    </p>
                  )}
                </div>

                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a password"
                            {...field}
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={register.isPending || usernameStatus === "taken" || (usernameValue.length >= 3 && usernameStatus === "checking")}
                  data-testid="button-register"
                >
                  {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </Form>
          )}

          <div className="text-center mt-6">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm"
              data-testid="button-toggle-mode"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}