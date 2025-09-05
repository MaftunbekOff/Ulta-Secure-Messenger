import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Shield, Mail, ArrowLeft, Loader2, User, Calendar, HelpCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { forgotPasswordSchema, type ForgotPasswordData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// Enhanced verification schemas
const emailVerificationSchema = z.object({
  email: z.string().email("Email manzil noto'g'ri formatda"),
});

const accountVerificationSchema = z.object({
  email: z.string().email("Email manzil noto'g'ri formatda"),
  username: z.string().min(1, "Username kiritish shart"),
  birthDate: z.string().min(1, "Tug'ilgan sana kiritish shart"),
});

const securityQuestionsSchema = z.object({
  answers: z.array(z.string().min(1, "Javob kiritish shart")),
});

type EmailVerificationData = z.infer<typeof emailVerificationSchema>;
type AccountVerificationData = z.infer<typeof accountVerificationSchema>;
type SecurityQuestionsData = z.infer<typeof securityQuestionsSchema>;

// Verification steps
type VerificationStep = 'email' | 'account' | 'security' | 'complete';

interface SecurityQuestion {
  id: string;
  question: string;
}

export default function ForgotPassword() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [resetToken, setResetToken] = useState("");
  const { toast } = useToast();

  // Email verification form
  const emailForm = useForm<EmailVerificationData>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: {
      email: "",
    },
  });

  // Account verification form  
  const accountForm = useForm<AccountVerificationData>({
    resolver: zodResolver(accountVerificationSchema),
    defaultValues: {
      email: "",
      username: "",
      birthDate: "",
    },
  });

  // Security questions form
  const securityForm = useForm<SecurityQuestionsData>({
    resolver: zodResolver(securityQuestionsSchema),
    defaultValues: {
      answers: [],
    },
  });

  // Step 1: Email verification
  const handleEmailVerification = async (data: EmailVerificationData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/auth/forgot-password/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setUserEmail(data.email);
        
        if (result.requiresAdditionalVerification) {
          // Set account form with email
          accountForm.setValue('email', data.email);
          setCurrentStep('account');
          
          toast({
            title: "🔐 Qo'shimcha tekshiruv",
            description: "Account ma'lumotlaringizni tasdiqlang",
          });
        } else {
          // Direct to completion
          setResetToken(result.resetToken);
          setCurrentStep('complete');
          
          toast({
            title: "✅ Muvaffaqiyat",
            description: result.message,
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "❌ Xatolik",
          description: error.message || "Email tekshirishda xatolik",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Xatolik", 
        description: "Server bilan bog'lanishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Account verification 
  const handleAccountVerification = async (data: AccountVerificationData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/auth/forgot-password/verify-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.requiresSecurityQuestions) {
          setSecurityQuestions(result.securityQuestions);
          
          // Initialize form with empty answers
          const emptyAnswers = result.securityQuestions.map(() => "");
          securityForm.setValue('answers', emptyAnswers);
          
          setCurrentStep('security');
          
          toast({
            title: "❓ Xavfsizlik savollari",
            description: "Xavfsizlik savollariga javob bering",
          });
        } else {
          // Account verified, go to completion
          setResetToken(result.resetToken);
          setCurrentStep('complete');
          
          toast({
            title: "✅ Muvaffaqiyat",
            description: result.message,
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "❌ Xatolik",
          description: error.message || "Account tekshirishda xatolik",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Xatolik", 
        description: "Server bilan bog'lanishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Security questions verification
  const handleSecurityVerification = async (data: SecurityQuestionsData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/auth/forgot-password/verify-security`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          answers: data.answers,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResetToken(result.resetToken);
        setCurrentStep('complete');
        
        toast({
          title: "✅ Muvaffaqiyat",
          description: result.message,
        });

        // Development only - show reset token in console
        if (result.resetToken) {
          console.log("🔑 Reset token:", result.resetToken);
          toast({
            title: "🔧 Development Mode",
            description: `Reset token: ${result.resetToken}`,
            variant: "default",
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "❌ Xatolik",
          description: error.message || "Xavfsizlik savollarida xatolik",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Xatolik", 
        description: "Server bilan bog'lanishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get step progress
  const getStepProgress = () => {
    switch (currentStep) {
      case 'email': return 25;
      case 'account': return 50;
      case 'security': return 75;
      case 'complete': return 100;
      default: return 0;
    }
  };

  // Step navigation
  const canGoBack = currentStep === 'account' || currentStep === 'security';
  const handleBack = () => {
    if (currentStep === 'account') {
      setCurrentStep('email');
    } else if (currentStep === 'security') {
      setCurrentStep('account');
    }
  };

  // Completion step
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold mx-auto mb-4">
              <Mail />
            </div>
            <CardTitle className="text-2xl">✅ Tekshiruv muvaffaqiyatli</CardTitle>
            <CardDescription>
              Parolni tiklash uchun link email manzilingizga yuborildi.
              Email qutingizni tekshiring va ko'rsatmalarga amal qiling.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                🔐 Xavfsizlik tekshiruvi o'tdi
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">
                Email: {userEmail}
              </div>
              {resetToken && (
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Token: {resetToken.substring(0, 8)}...
                </div>
              )}
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              Email kelmagan bo'lsa, spam qutisini ham tekshiring
            </div>
            
            <Link href="/login">
              <Button variant="outline" className="w-full" data-testid="button-back-to-login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Loginiga qaytish
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4">
            <Shield />
          </div>
          <CardTitle className="text-2xl">🔐 Parolni tiklash</CardTitle>
          <CardDescription>
            {currentStep === 'email' && "Email manzilingizni kiriting"}
            {currentStep === 'account' && "Account ma'lumotlaringizni tasdiqlang"}
            {currentStep === 'security' && "Xavfsizlik savollariga javob bering"}
          </CardDescription>
          
          {/* Progress indicator */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Jarayon:</span>
              <span>{getStepProgress()}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
            <div className="flex items-center justify-between text-xs">
              <Badge variant={currentStep === 'email' ? 'default' : 'secondary'} className="text-xs">
                📧 Email
              </Badge>
              <Badge variant={currentStep === 'account' ? 'default' : 'secondary'} className="text-xs">
                👤 Account
              </Badge>
              <Badge variant={currentStep === 'security' ? 'default' : 'secondary'} className="text-xs">
                ❓ Xavfsizlik
              </Badge>
              <Badge variant={currentStep === 'complete' ? 'default' : 'secondary'} className="text-xs">
                ✅ Tayyor
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: Email Verification */}
          {currentStep === 'email' && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleEmailVerification)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>📧 Email manzil</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                          data-testid="input-email-verification"
                          className="h-12 text-base"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base"
                  disabled={isLoading}
                  data-testid="button-verify-email"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Tekshirilmoqda...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Email tekshirish
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/login">
                    <Button
                      variant="link"
                      className="text-sm"
                      data-testid="link-back-to-login"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Loginiga qaytish
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          )}

          {/* Step 2: Account Verification */}
          {currentStep === 'account' && (
            <Form {...accountForm}>
              <form onSubmit={accountForm.handleSubmit(handleAccountVerification)} className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Qo'shimcha xavfsizlik tekshiruvi</span>
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Account ma'lumotlaringizni tasdiqlang
                  </div>
                </div>

                <FormField
                  control={accountForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>📧 Email manzil</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          data-testid="input-account-email"
                          className="h-12 text-base"
                          disabled={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={accountForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>👤 Username</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Username kiriting"
                          {...field}
                          data-testid="input-account-username"
                          className="h-12 text-base"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={accountForm.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>📅 Tug'ilgan sana</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-account-birthdate"
                          className="h-12 text-base"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  {canGoBack && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleBack}
                      disabled={isLoading}
                      data-testid="button-back"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Orqaga
                    </Button>
                  )}
                  
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1 h-12"
                    disabled={isLoading}
                    data-testid="button-verify-account"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Tekshirilmoqda...
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Tasdiqlash
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* Step 3: Security Questions */}
          {currentStep === 'security' && (
            <Form {...securityForm}>
              <form onSubmit={securityForm.handleSubmit(handleSecurityVerification)} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Xavfsizlik savollari</span>
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Barcha savollarga to'g'ri javob bering
                  </div>
                </div>

                {securityQuestions.map((question, index) => (
                  <FormField
                    key={question.id}
                    control={securityForm.control}
                    name={`answers.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          {index + 1}. {question.question}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Javobingizni kiriting"
                            {...field}
                            data-testid={`input-security-answer-${index}`}
                            className="h-12 text-base"
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                <div className="flex gap-2">
                  {canGoBack && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleBack}
                      disabled={isLoading}
                      data-testid="button-back-security"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Orqaga
                    </Button>
                  )}
                  
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1 h-12"
                    disabled={isLoading}
                    data-testid="button-verify-security"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Tekshirilmoqda...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Yakunlash
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}