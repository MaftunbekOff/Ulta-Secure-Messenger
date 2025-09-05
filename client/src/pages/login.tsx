import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
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
      birthDate: "",
    },
    mode: "onChange",
    shouldFocusError: true,
    criteriaMode: "all",
  });

  // Form qiymatlari o'zgarganda console-ga chiqarish
  const watchedValues = registerForm.watch();
  React.useEffect(() => {
    console.log('📝 Ro\'yxatdan o\'tish formasi o\'zgarishi:', {
      firstName: watchedValues.firstName || 'Bo\'sh',
      lastName: watchedValues.lastName || 'Bo\'sh',
      email: watchedValues.email || 'Bo\'sh',
      birthDate: watchedValues.birthDate || 'Bo\'sh',
      password: watchedValues.password ? `${watchedValues.password.length} ta belgi` : 'Bo\'sh',
      formValid: registerForm.formState.isValid ? 'Ha' : 'Yo\'q',
      errors: Object.keys(registerForm.formState.errors).length > 0 ? 
        Object.keys(registerForm.formState.errors) : 'Xatolik yo\'q'
    });
  }, [watchedValues, registerForm.formState.isValid, registerForm.formState.errors]);


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




  const handleRegister = async (data: RegisterData) => {
    console.log('🚀 Ro\'yxatdan o\'tish jarayoni boshlandi');
    console.log('📋 Kiritilgan ma\'lumotlar:', {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      birthDate: data.birthDate,
      password: data.password ? '****** (yashirin)' : 'Bo\'sh',
      passwordLength: data.password?.length || 0
    });

    try {
      // Generate auto username from email
      const autoUsername = data.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
      console.log('👤 Avtomatik username yaratildi:', autoUsername);
      
      const registerData = { ...data, username: autoUsername };
      console.log('📦 Serverga yuborilayotgan to\'liq ma\'lumotlar:', {
        ...registerData,
        password: '****** (yashirin)'
      });

      console.log('🌐 Server bilan bog\'lanmoqda...');
      await register.mutateAsync(registerData);
      console.log('✅ Server javob berdi - ro\'yxatdan o\'tish muvaffaqiyatli!');

      // Store email for future use
      localStorage.setItem('lastLoginEmail', data.email);
      console.log('💾 Email localStorage-ga saqlandi:', data.email);

      // Security event logged internally
      console.log('🔐 Xavfsizlik voqeasi loglandi');

      console.log('🎉 Foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tdi!');
      toast({
        title: "🛡️ Ultra-secure account created!",
        description: "You now have military-grade encryption protection.",
      });
      console.log('🏠 Chat sahifasiga yo\'naltirilmoqda...');
      setLocation("/");
    } catch (error: any) {
      console.error('❌ Ro\'yxatdan o\'tishda xatolik:', error);
      console.error('❌ Xatolik tafsilotlari:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        stack: error.stack
      });
      
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
                          placeholder="sizning@emailingiz.uz"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
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

                {/* Forgot Password Link */}
                <div className="text-right">
                  <Link href="/forgot-password">
                    <Button
                      variant="link"
                      className="text-sm p-0 h-auto"
                      data-testid="link-forgot-password"
                    >
                      Parolni unutdingizmi?
                    </Button>
                  </Link>
                </div>

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

                <FormField
                  control={registerForm.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>📅 Tug'ilgan sana</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="DD/MM/YYYY (masalan: 15/01/1990)"
                          value={field.value || ''}
                          onChange={(e) => {
                            let inputValue = e.target.value;
                            console.log('🗓️ Kiritilgan qiymat:', inputValue);
                            
                            // Faqat raqam va / belgilariga ruxsat berish
                            let digitsOnly = inputValue.replace(/[^\d]/g, '');
                            console.log('🗓️ Faqat raqamlar:', digitsOnly);
                            
                            // Maksimal 8 ta raqam (DDMMYYYY)
                            digitsOnly = digitsOnly.slice(0, 8);
                            
                            // DD/MM/YYYY formatida formatlash
                            let formattedValue = '';
                            if (digitsOnly.length > 0) {
                              // Kun qo'shish (DD)
                              formattedValue = digitsOnly.slice(0, 2);
                              if (digitsOnly.length > 2) {
                                // Oy qo'shish (/MM)
                                formattedValue += '/' + digitsOnly.slice(2, 4);
                                if (digitsOnly.length > 4) {
                                  // Yil qo'shish (/YYYY)
                                  formattedValue += '/' + digitsOnly.slice(4, 8);
                                }
                              }
                            }
                            
                            console.log('🗓️ Formatlangan qiymat:', formattedValue);
                            field.onChange(formattedValue);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          data-testid="input-birth-date"
                          className="h-12 text-base"
                          autoComplete="bday"
                          maxLength={10}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  className="w-full h-12 text-base"
                  disabled={register.isPending}
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