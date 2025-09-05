import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema, type ResetPasswordData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get token from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = async (data: ResetPasswordData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setIsSuccess(true);
        
        toast({
          title: "✅ Muvaffaqiyat",
          description: result.message,
        });

        // Redirect to login after 3 seconds
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else {
        const error = await response.json();
        toast({
          title: "❌ Xatolik",
          description: error.message || "Parolni o'zgartirishda xatolik",
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 text-2xl font-bold mx-auto mb-4">
              ❌
            </div>
            <CardTitle className="text-2xl">Yaroqsiz havola</CardTitle>
            <CardDescription>
              Parolni tiklash havolasi yaroqsiz yoki buzilgan. 
              Iltimos, yangi havola so'rang.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setLocation("/forgot-password")}
              className="w-full"
              data-testid="button-request-new-link"
            >
              Yangi havola so'rash
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold mx-auto mb-4">
              <CheckCircle />
            </div>
            <CardTitle className="text-2xl">✅ Parol o'zgartirildi</CardTitle>
            <CardDescription>
              Parolingiz muvaffaqiyatli o'zgartirildi. 
              Endi yangi parol bilan kirishingiz mumkin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              3 soniyadan keyin login sahifasiga yo'naltirilasiz...
            </div>
            
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
              data-testid="button-go-to-login"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Loginiga o'tish
            </Button>
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
          <CardTitle className="text-2xl">🔐 Yangi parol o'rnatish</CardTitle>
          <CardDescription>
            Hisobingiz uchun yangi, xavfsiz parol yarating.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Hidden token field */}
              <input type="hidden" value={token} />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>🔑 Yangi parol</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Yangi parol kiriting"
                          {...field}
                          data-testid="input-new-password"
                          className="h-12 text-base pr-12"
                          disabled={isLoading}
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

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>🔄 Parolni tasdiqlang</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Parolni qayta kiriting"
                          {...field}
                          data-testid="input-confirm-password"
                          className="h-12 text-base pr-12"
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? (
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
                disabled={isLoading}
                data-testid="button-reset-password"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    O'zgartirilmoqda...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Parolni o'zgartirish
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={() => setLocation("/login")}
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Loginiga qaytish
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}